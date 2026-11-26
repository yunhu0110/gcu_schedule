"""
축1 · 의미 벡터 적재 (KR-SBERT → public.hw_word_vectors, 768차원)

fastText 단어벡터보다 한국어 유사도가 정확한 문장임베딩(KR-SBERT)으로 어휘를 임베딩한다.
어휘(추측 대상 명사 사전)는 코퍼스 명사 빈도 + 사전 표제어 + 풀 단어로 구성한다
 → '실시간 임의 단어 허용'을 대규모 명사 어휘 사전계산으로 실현.

입력:
  --corpus DIR ...   : 명사 어휘 수집용 평문 코퍼스(위키/나무위키 추출본). 빈도 상위 N개 채택.
  --vocab FILE ...   : 추가 표제어 목록(한 줄 1단어). 우리말샘/기초사전 표제어 등. (선택)
  --model NAME       : sentence-transformers 모델. 기본 snunlp/KR-SBERT-V40K-klueNLI-augSTS
  --top N            : 코퍼스 명사 빈도 상위 N개 (기본 200000)

실행:
  export SUPABASE_DB_URL=...
  python build_semantic.py --corpus ./extracted ./namu_text --vocab urimalsaem_headwords.txt --top 200000
"""
from __future__ import annotations
import argparse, os, re
from collections import Counter
from tqdm import tqdm
from common import db, pool_words, normalize, kiwi, is_single_noun

_TAG = re.compile(r"<[^>]+>")


def iter_lines(root: str):
    for dirpath, _, files in os.walk(root):
        for fn in files:
            with open(os.path.join(dirpath, fn), encoding="utf-8", errors="ignore") as f:
                for line in f:
                    line = _TAG.sub("", line).strip()
                    if line:
                        yield line


def corpus_noun_freq(dirs: list[str]) -> Counter:
    cnt = Counter()
    for root in dirs:
        print(f"코퍼스 명사 빈도 수집… {root}")
        for line in tqdm(iter_lines(root)):
            for t in kiwi().tokenize(line):
                if t.tag in ("NNG", "NNP"):
                    cnt[normalize(t.form)] += 1
    return cnt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", nargs="*", default=[], help="명사 어휘 수집용 코퍼스 디렉터리들")
    ap.add_argument("--vocab", nargs="*", default=[], help="추가 표제어 목록 파일들(한 줄 1단어)")
    ap.add_argument("--model", default="snunlp/KR-SBERT-V40K-klueNLI-augSTS")
    ap.add_argument("--top", type=int, default=200000)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--no-filter", action="store_true",
                    help="--vocab 목록을 명사 필터(kiwi) 없이 그대로 사용(우리말샘 표제어 등 이미 걸러진 목록)")
    args = ap.parse_args()

    conn = db()
    pool = set(pool_words(conn))

    # 1) 어휘 집합 구성: 풀 단어 + 코퍼스 명사 상위 N + 표제어 파일
    vocab: set[str] = set(pool)
    if args.corpus:
        freq = corpus_noun_freq(args.corpus)
        for w, _ in freq.most_common(args.top):
            vocab.add(w)
    for vf in args.vocab:
        with open(vf, encoding="utf-8") as f:
            for line in f:
                w = normalize(line)
                if w and (args.no_filter or is_single_noun(w)):
                    vocab.add(w)
    words = sorted(vocab)
    print(f"어휘 {len(words)}개 임베딩 대상")

    # 2) KR-SBERT 임베딩 (정규화해서 cosine 거리와 일관). Apple GPU(MPS) 있으면 사용.
    import torch
    from sentence_transformers import SentenceTransformer
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"모델 로드… {args.model} (device={device})")
    model = SentenceTransformer(args.model, device=device)

    def vec_literal(arr) -> str:
        return "[" + ",".join(f"{x:.6f}" for x in arr) + "]"

    print("임베딩 + 적재…")
    with conn.cursor() as cur:
        for i in tqdm(range(0, len(words), args.batch)):
            chunk = words[i:i + args.batch]
            embs = model.encode(chunk, normalize_embeddings=True, show_progress_bar=False)
            rows = [(w, vec_literal(e), True) for w, e in zip(chunk, embs)]
            cur.executemany(
                "insert into public.hw_word_vectors(word, vec, is_noun) "
                "values (%s, %s::extensions.halfvec, %s) "
                "on conflict (word) do update set vec = excluded.vec, is_noun = excluded.is_noun",
                rows,
            )
            conn.commit()
    conn.close()
    print("완료.")


if __name__ == "__main__":
    main()
