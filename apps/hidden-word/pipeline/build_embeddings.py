"""
build_embeddings.py — Phase 3: 의미 임베딩 학습 (지시서 §5-1 의미축, 40%)

전처리 산출(processed/corpus/**/*.jsonl)의 '내용어 토큰열'로 word2vec(skip-gram)을 직접 학습한다.
  · 학습 입력: 명사(N)+용언기본형(V)+일반부사(M) — 넓은 분포의미 확보용.
  · 보존 대상: 명사(N) 벡터만(게임 어휘). 용언/부사는 문맥으로만 기여하고 저장하지 않는다.
  · 도메인 불균형(문어≫대화)은 word2vec subsampling(sample)로 완화 — 별도 도메인 정규화는 문맥축(§5-2)에서.
NOTE(revised Q1): 벡터는 '사전 정의'가 아니라 'NIKL 말뭉치 분포'에서 학습한다.
                  외부 사전학습(fastText cc.ko.300)·opendict 사전은 의미축에 쓰지 않는다.

캘리브레이션(§5 MAD/z/sigmoid)은 Phase 7 엔진에서 '히든워드↔힌트' 비교 맥락으로 수행.
여기서는 벡터와 어휘 분포 통계만 산출한다.

산출(apps/hidden-word/data/embeddings/, DB 미적재·gitignore):
  w2v.kv              gensim KeyedVectors(전체) — 재현/디버그용
  nouns.vec.jsonl     명사별 {"w":단어,"v":[float×dim]} (Phase 6 양자화 적재 입력)
  embed_report.json   학습 파라미터·어휘수·검증쌍 코사인

실행: .venv/bin/python build_embeddings.py --dim 200 --epochs 5
"""
from __future__ import annotations
import argparse, glob, json, os, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORP = os.path.join(ROOT, "data", "processed", "corpus")
OUTDIR = os.path.join(ROOT, "data", "embeddings")

# 검증쌍(revised Q1) — 학습 후 코사인이 상식에 맞는지 점검
VALIDATION = [
    ("나무", "소나무"), ("나무", "도토리"), ("나무", "버섯"), ("나무", "숲"), ("나무", "질책"),
    ("뜨겁다", "차갑다"), ("여름", "겨울"),
]


class Corpus:
    """processed JSONL 스트리밍 → 문장별 토큰 리스트(gensim 학습용). 메모리 미적재."""
    def __init__(self, root: str):
        self.files = sorted(glob.glob(os.path.join(root, "**", "*.jsonl"), recursive=True))

    def __iter__(self):
        for path in self.files:
            with open(path, encoding="utf-8") as f:
                for line in f:
                    try:
                        toks = json.loads(line)["t"]
                    except Exception:
                        continue
                    # 용언은 기본형+품사 접미로 명사와 구분(동형이의 혼선 방지)
                    yield [w if p == "N" else f"{w}{p}" for w, p in toks]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dim", type=int, default=200)
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--min-count", type=int, default=5)
    ap.add_argument("--epochs", type=int, default=5)
    ap.add_argument("--workers", type=int, default=8)
    args = ap.parse_args()

    from gensim.models import Word2Vec

    os.makedirs(OUTDIR, exist_ok=True)
    t0 = time.time()
    sentences = Corpus(CORP)
    print(f"코퍼스 샤드 {len(sentences.files):,}개 → word2vec(sg) dim={args.dim} 학습…", flush=True)

    model = Word2Vec(
        sentences=sentences, vector_size=args.dim, window=args.window,
        min_count=args.min_count, sg=1, negative=10, sample=1e-4,
        epochs=args.epochs, workers=args.workers,
    )
    kv = model.wv
    kv.save(os.path.join(OUTDIR, "w2v.kv"))
    print(f"학습 완료: 어휘 {len(kv):,} · {time.time()-t0:.0f}s", flush=True)

    # 명사 벡터만 추출(용언/부사 토큰은  포함 → 제외)
    nouns = [w for w in kv.index_to_key if not (w.endswith("V") or w.endswith("M"))]
    npath = os.path.join(OUTDIR, "nouns.vec.jsonl")
    with open(npath, "w", encoding="utf-8") as f:
        for w in nouns:
            f.write(json.dumps({"w": w, "v": [round(float(x), 6) for x in kv[w]]},
                               ensure_ascii=False) + "\n")

    val = []
    for a, b in VALIDATION:
        ta = a if a in kv else f"{a}V"   # 용언 검증쌍(뜨겁다 등)은 V 접미로 조회
        tb = b if b in kv else f"{b}V"
        if ta in kv and tb in kv:
            val.append({"pair": [a, b], "cos": round(float(kv.similarity(ta, tb)), 4)})
        else:
            val.append({"pair": [a, b], "cos": None, "missing": True})

    report = {
        "params": {"dim": args.dim, "window": args.window, "min_count": args.min_count,
                   "epochs": args.epochs, "sg": 1},
        "vocab_total": len(kv), "noun_vectors": len(nouns),
        "validation": val, "elapsed_sec": round(time.time() - t0),
    }
    with open(os.path.join(OUTDIR, "embed_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"명사 벡터 {len(nouns):,} → {npath}")
    print("검증쌍 코사인:")
    for v in val:
        print(f"  {v['pair'][0]}~{v['pair'][1]}: {v.get('cos')}")


if __name__ == "__main__":
    main()
