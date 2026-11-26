"""
축2 · 문맥 공생 PPMI 적재 (한국어 코퍼스 → public.hw_word_cooc)

코퍼스가 클수록 일상어 공생(나무↔버섯 류)이 촘촘해진다. 위키 + 나무위키를 함께 넣는 걸 권장.
핵심 최적화: '한쪽이 풀 단어'인 공생쌍만 저장(테이블 작게 유지).

입력(여러 개 혼용 가능):
  --corpus DIR ...   : 평문 코퍼스 디렉터리들 (wikiextractor 추출본 등)
  --namu FILE ...    : 나무위키 JSON 덤프(items 배열, 각 item.text). CC BY-NC-SA(비영리) — 6인 비영리 사용.

전처리(위키):
  python -m wikiextractor.WikiExtractor kowiki-latest-pages-articles.xml.bz2 -o extracted --no-templates

실행:
  export SUPABASE_DB_URL=...
  python build_contextual.py --corpus ./extracted --namu ./namuwiki.json --window 5 --topk 200 --min-count 5
"""
from __future__ import annotations
import argparse, math, os, re
from collections import defaultdict, Counter
from tqdm import tqdm
from common import db, pool_words, kiwi, normalize

_TAG = re.compile(r"<[^>]+>")
_NAMU = re.compile(r"\[\[|\]\]|'''|''|\{\{|\}\}|==+|\|")  # 나무위키 마크업 대충 제거


def iter_dir_lines(root: str):
    for dirpath, _, files in os.walk(root):
        for fn in files:
            with open(os.path.join(dirpath, fn), encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = _TAG.sub("", line).strip()
                    if line:
                        yield line


def iter_namu_lines(path: str):
    # 나무위키 덤프는 거대한 JSON 배열 → ijson 으로 스트리밍
    import ijson
    with open(path, "rb") as f:
        for item in ijson.items(f, "item"):
            text = item.get("text") if isinstance(item, dict) else None
            if not text:
                continue
            for line in _NAMU.sub(" ", text).splitlines():
                line = line.strip()
                if line:
                    yield line


def nouns(line: str) -> list[str]:
    return [normalize(t.form) for t in kiwi().tokenize(line) if t.tag in ("NNG", "NNP")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", nargs="*", default=[])
    ap.add_argument("--namu", nargs="*", default=[])
    ap.add_argument("--window", type=int, default=5)
    ap.add_argument("--topk", type=int, default=200)
    ap.add_argument("--min-count", type=int, default=5)
    ap.add_argument("--min-partner-count", type=int, default=30,
                    help="상대어(비풀) 코퍼스 등장 횟수 하한. PPMI 희귀어 편향 제거 "
                         "(이보다 드문 단어는 공기쌍에서 제외 → 불사약/후타바군류 노이즈 차단)")
    args = ap.parse_args()

    if not args.corpus and not args.namu:
        raise SystemExit("--corpus 또는 --namu 중 하나는 필요합니다.")

    conn = db()
    pool = set(pool_words(conn))

    cnt = Counter(); total_tok = 0
    cooc = defaultdict(int); total_pairs = 0

    def feed(line_iter):
        nonlocal total_tok, total_pairs
        for line in tqdm(line_iter):
            toks = nouns(line)
            if not toks:
                continue
            for t in toks:
                cnt[t] += 1
            total_tok += len(toks)
            n = len(toks)
            for i in range(n):
                lo, hi = max(0, i - args.window), min(n, i + args.window + 1)
                for j in range(lo, hi):
                    if j == i:
                        continue
                    a, b = toks[i], toks[j]
                    if a in pool and a != b:
                        cooc[(a, b)] += 1
                        total_pairs += 1

    for d in args.corpus:
        print(f"코퍼스 스캔… {d}"); feed(iter_dir_lines(d))
    for p in args.namu:
        print(f"나무위키 스캔… {p}"); feed(iter_namu_lines(p))

    print(f"PPMI 계산(총 토큰 {total_tok}, 공생쌍 {total_pairs})…")
    per_pool: dict[str, list[tuple[str, float]]] = defaultdict(list)
    for (a, b), c in cooc.items():
        if c < args.min_count:
            continue
        if cnt[b] < args.min_partner_count:   # 상대어가 코퍼스에서 너무 드물면 제외(희귀어 PPMI 폭등 차단)
            continue
        p_ab = c / total_pairs
        p_a = cnt[a] / total_tok
        p_b = cnt[b] / total_tok
        if p_a <= 0 or p_b <= 0:
            continue
        ppmi = max(0.0, math.log2(p_ab / (p_a * p_b)))
        if ppmi > 0:
            per_pool[a].append((b, ppmi))

    rows: list[tuple[str, str, float]] = []
    for a, lst in per_pool.items():
        lst.sort(key=lambda x: x[1], reverse=True)
        for b, ppmi in lst[: args.topk]:
            wa, wb = (a, b) if a < b else (b, a)
            rows.append((wa, wb, round(ppmi, 4)))

    print(f"{len(rows)}개 공생쌍 → hw_word_cooc upsert")
    with conn.cursor() as cur:
        cur.executemany(
            "insert into public.hw_word_cooc(word_a, word_b, ppmi) values (%s,%s,%s) "
            "on conflict (word_a, word_b) do update set ppmi = greatest(hw_word_cooc.ppmi, excluded.ppmi)",
            rows,
        )
        conn.commit()
    conn.close()
    print("완료.")


if __name__ == "__main__":
    main()
