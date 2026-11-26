"""
build_cooccurrence.py — Phase 4: 문맥 공생 NPMI (지시서 §5-2 문맥축, 35%)

전처리 산출(processed/corpus/**/*.jsonl)의 명사(N) 토큰으로 문맥 공생도를 계산한다.
  · 창(window): 같은 문장 내 ±5 형태소(명사 기준 인접). (지시서 §5-2)
  · 지표: NPMI = PMI / -log2 p(a,b)  ∈ [-1,1]  — PPMI 희귀어 편향을 빈도 정규화로 억제.
  · 도메인 분리 정규화(revised Q1): written·spoken 각각 NPMI 계산 후, 두 도메인 평균으로 결합
                                   (한 도메인 빈도 쏠림이 점수를 지배하지 못하게).
  · 저장 최적화(§9): 전체 V² 미계산. 어휘(words)에 속한 단어만 앵커로, 앵커별 top-K 상대어만 저장.
                     상대어도 어휘집합 내 + 코퍼스 최소빈도 이상(희귀어 노이즈 차단).

산출(apps/hidden-word/data/processed/cooccurrence.jsonl, DB 미적재·gitignore):
  {"a","b","npmi"}  (a<b canonical). DB 적재는 Phase 6.

실행:
  .venv/bin/python build_cooccurrence.py --vocab ../data/processed/vocab_nouns.txt \
      --window 5 --topk 150 --min-count 10 --min-partner-count 20
"""
from __future__ import annotations
import argparse, glob, json, math, os, time
from collections import defaultdict, Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORP = os.path.join(ROOT, "data", "processed", "corpus")
OUT = os.path.join(ROOT, "data", "processed", "cooccurrence.jsonl")


def iter_noun_sentences(domain: str, vocab: set | None):
    """해당 도메인 샤드의 문장별 명사 토큰열. vocab 이 있으면 어휘 명사만 남긴다.
    (양 끝이 모두 어휘인 쌍만 적재하므로, 비어휘 명사는 누적 단계에서 미리 제거 — 메모리·속도 핵심)."""
    root = os.path.join(CORP, domain)
    for path in sorted(glob.glob(os.path.join(root, "*.jsonl"))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                try:
                    toks = json.loads(line)["t"]
                except Exception:
                    continue
                if vocab is None:
                    yield [w for w, p in toks if p == "N"]
                else:
                    yield [w for w, p in toks if p == "N" and w in vocab]


def domain_npmi(domain: str, window: int, min_count: int, min_partner: int,
                vocab: set | None) -> dict[tuple, float]:
    """한 도메인의 NPMI. 어휘 명사열에서 창 내 공기쌍을 집계(양 끝 모두 어휘).
    확률 정규화(p(a),p(b),p(a,b))는 어휘-토큰 공간 기준으로 일관되게 계산."""
    cnt = Counter(); cooc = Counter(); total_tok = 0; total_pair = 0
    for toks in iter_noun_sentences(domain, vocab):
        n = len(toks)
        if n < 2:
            if n == 1:
                cnt[toks[0]] += 1; total_tok += 1
            continue
        for t in toks:
            cnt[t] += 1
        total_tok += n
        for i in range(n):
            a = toks[i]
            lo, hi = max(0, i - window), min(n, i + window + 1)
            for j in range(lo, hi):
                if j == i:
                    continue
                b = toks[j]
                if a != b:
                    cooc[(a, b)] += 1
                    total_pair += 1
    out = {}
    if total_pair == 0:
        return out
    lt = math.log2(total_tok); lp = math.log2(total_pair)
    for (a, b), c in cooc.items():
        if c < min_count or cnt[b] < min_partner:
            continue
        # log2 p(a,b) = log2(c/total_pair); p(a)=cnt[a]/total_tok …
        l_pab = math.log2(c) - lp
        pmi = l_pab - (math.log2(cnt[a]) - lt) - (math.log2(cnt[b]) - lt)
        npmi = pmi / (-l_pab) if l_pab < 0 else 0.0
        if npmi > 0:
            out[(a, b)] = npmi
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vocab", help="어휘 명사 목록(한 줄 1단어). 없으면 전체 명사 앵커")
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--topk", type=int, default=150)
    ap.add_argument("--min-count", type=int, default=10)
    ap.add_argument("--min-partner-count", type=int, default=20)
    args = ap.parse_args()

    vocab = None
    if args.vocab:
        with open(args.vocab, encoding="utf-8") as f:
            vocab = {w.strip() for w in f if w.strip()}
        print(f"어휘 {len(vocab):,} 로드 — 앵커 한정")

    t0 = time.time()
    per_domain = {}
    for dom in ("written", "spoken"):
        print(f"[{dom}] NPMI 계산…", flush=True)
        per_domain[dom] = domain_npmi(dom, args.window, args.min_count,
                                      args.min_partner_count, vocab)
        print(f"  {dom}: 양수 NPMI 쌍 {len(per_domain[dom]):,}  ({time.time()-t0:.0f}s)")

    # 도메인 결합: 두 도메인 평균(한쪽만 있으면 그 값 * 0.5 로 감쇠 — 단일도메인 편향 억제)
    keys = set(per_domain["written"]) | set(per_domain["spoken"])
    combined: dict[tuple, float] = {}
    for k in keys:
        vw = per_domain["written"].get(k); vs = per_domain["spoken"].get(k)
        vals = [v for v in (vw, vs) if v is not None]
        combined[k] = sum(vals) / 2.0  # 결측 도메인은 0 취급 → 양 도메인 공유쌍 가점
    # 앵커별 top-K
    per_anchor = defaultdict(list)
    for (a, b), v in combined.items():
        per_anchor[a].append((b, v))
    rows = []
    seen = set()
    for a, lst in per_anchor.items():
        lst.sort(key=lambda x: x[1], reverse=True)
        for b, v in lst[: args.topk]:
            wa, wb = (a, b) if a < b else (b, a)
            if (wa, wb) in seen:
                continue
            seen.add((wa, wb))
            rows.append({"a": wa, "b": wb, "npmi": round(v, 4)})

    with open(OUT, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"공생쌍 {len(rows):,} → {OUT}  ({time.time()-t0:.0f}s)")


if __name__ == "__main__":
    main()
