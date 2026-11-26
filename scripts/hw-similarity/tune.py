"""
가중치 튜닝 / 품질 검증.

(A) 의미축 객관 검증 — KorSTS(사람 유사도 정답, 문장 단위)로 KR-SBERT Spearman 상관을 측정.
    KorSTS는 '문장' 쌍이라 단어 가중치를 직접 못 맞춘다 → 의미축 모델이 쓸 만한지 확인하는 용도.
    데이터: kakaobrain/KorNLUDatasets 의 KorSTS (sts-dev.tsv / sts-test.tsv, 탭 구분, 마지막 열 score 0~5)

(B) 블렌드 가중치 튜닝(비순환) — hw_word_relations 의 관계쌍(synonym/hypernym/hyponym)을
    '정답(관련)'으로, 무작위 쌍을 '오답(무관)'으로 두고, 관계 성분을 0으로 가린 채
    (= 관계 테이블에 없는 실제 추측 상황을 모사) sem/ctx 비율을 그리드 서치로 최적화한다.
    → w_sem : w_ctx 권장 비율을 출력. w_rel(관계 신뢰도)은 별도 prior 로 유지.

실행:
  export SUPABASE_DB_URL=...
  python tune.py                         # (B) 가중치 튜닝
  python tune.py --korsts ./sts-test.tsv # (A) + (B)
"""
from __future__ import annotations
import argparse, random
from common import db


def pair_components(cur, a: str, b: str):
    """(sem, ctx) 성분. 벡터 없으면 sem=None."""
    cur.execute(
        """
        select
          (select greatest(0.0, 1.0 - (va.vec <=> vb.vec))
             from (select vec from hw_word_vectors where word=%s) va,
                  (select vec from hw_word_vectors where word=%s) vb) as sem,
          coalesce((select least(1.0, ppmi/8.0) from hw_word_cooc
                     where word_a=least(%s,%s) and word_b=greatest(%s,%s)), 0) as ctx
        """,
        (a, b, a, b, a, b),
    )
    sem, ctx = cur.fetchone()
    return (None if sem is None else float(sem)), float(ctx)


def auc(pos: list[float], neg: list[float]) -> float:
    # Mann-Whitney U 기반 AUC
    if not pos or not neg:
        return float("nan")
    wins = 0.0
    for p in pos:
        for n in neg:
            wins += 1.0 if p > n else (0.5 if p == n else 0.0)
    return wins / (len(pos) * len(neg))


def tune_weights(conn):
    with conn.cursor() as cur:
        cur.execute(
            "select word, related from hw_word_relations "
            "where relation in ('synonym','hypernym','hyponym')"
        )
        positives = cur.fetchall()
        cur.execute("select word from hw_word_vectors where is_noun limit 20000")
        vocab = [w for (w,) in cur.fetchall()]

        if not positives or not vocab:
            print("관계쌍 또는 어휘가 비어 있습니다. 먼저 데이터를 적재하세요.")
            return

        random.seed(42)
        # 성분 수집(관계 성분은 0으로 가림 → 비순환)
        pos_c, neg_c = [], []
        for a, b in positives:
            s, c = pair_components(cur, a, b)
            pos_c.append((s, c))
        pool = sorted({a for a, _ in positives})
        for _ in range(len(positives)):
            a = random.choice(pool); b = random.choice(vocab)
            s, c = pair_components(cur, a, b)
            neg_c.append((s, c))

    print(f"정답쌍 {len(pos_c)} · 오답쌍 {len(neg_c)} 로 w_sem:w_ctx 그리드 서치")
    best = None
    for i in range(0, 11):
        w_sem = i / 10.0
        w_ctx = 1.0 - w_sem

        def blend(sc):
            s, c = sc
            wsum = (w_sem if s is not None else 0) + (w_ctx if c > 0 else 0)
            if wsum == 0:
                return 0.0
            return ((w_sem * s if s is not None else 0) + (w_ctx * c if c > 0 else 0)) / wsum

        a = auc([blend(x) for x in pos_c], [blend(x) for x in neg_c])
        if best is None or a > best[0]:
            best = (a, w_sem, w_ctx)
        print(f"  w_sem={w_sem:.1f} w_ctx={w_ctx:.1f} → AUC {a:.4f}")

    a, w_sem, w_ctx = best
    # w_rel prior(0.25) 유지, 나머지 0.75 를 최적 비율로 분배
    rel = 0.25
    rest = 1.0 - rel
    print("\n=== 권장 가중치 (0032 상수에 반영) ===")
    print(f"  w_sem ≈ {rest*w_sem:.2f}  w_ctx ≈ {rest*w_ctx:.2f}  w_rel = {rel:.2f}   (best AUC {a:.4f})")


def eval_korsts(path: str):
    try:
        from sentence_transformers import SentenceTransformer, util
        from scipy.stats import spearmanr
    except Exception as e:
        print(f"KorSTS 평가 생략(의존성 없음): {e}"); return
    rows = []
    with open(path, encoding="utf-8") as f:
        header = f.readline()
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 3:
                continue
            try:
                score = float(cols[-1]); s1, s2 = cols[-3], cols[-2]
            except ValueError:
                continue
            rows.append((s1, s2, score))
    if not rows:
        print("KorSTS 파싱 실패"); return
    model = SentenceTransformer("snunlp/KR-SBERT-V40K-klueNLI-augSTS")
    e1 = model.encode([r[0] for r in rows], normalize_embeddings=True)
    e2 = model.encode([r[1] for r in rows], normalize_embeddings=True)
    cos = [float(util.cos_sim(a, b)) for a, b in zip(e1, e2)]
    rho, _ = spearmanr(cos, [r[2] for r in rows])
    print(f"KorSTS Spearman(KR-SBERT cosine vs 사람) = {rho:.4f}  (높을수록 의미축 신뢰도↑)\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--korsts", help="KorSTS tsv 경로(선택)")
    args = ap.parse_args()
    if args.korsts:
        eval_korsts(args.korsts)
    conn = db()
    tune_weights(conn)
    conn.close()


if __name__ == "__main__":
    main()
