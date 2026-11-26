"""
load_to_supabase.py — Phase 6: 가공 산출을 Supabase(Postgres)에 적재 (지시서 §6·§9·§10)

전제: 0036 스키마가 이미 적용되어 있어야 한다(hw_words/…/hw_word_embeddings).

적재 순서(참조 무결성):
  1) hw_words                 lexicon/words.jsonl  (usable 포함)
  2) hw_word_senses           lexicon/word_senses.jsonl
  3) hw_word_categories       lexicon/word_categories.jsonl
  4) hw_word_relations        processed/relations.jsonl   — 양 끝이 모두 어휘(hw_words)인 간선만(§9)
  5) hw_word_cooc             processed/cooccurrence.jsonl — 양 끝 모두 어휘(앵커 한정이라 a는 이미 어휘)
  6) hw_word_embeddings       embeddings/nouns.vec.jsonl  — halfvec(200), 어휘 단어만

안전장치(§9):
  · 원본 말뭉치는 적재하지 않는다. 가공 결과만.
  · 매 단계 전후로 pg_database_size 를 측정, DB 총사용량이 --hard-stop(기본 400MB)에 도달하면
    해당 단계를 적재하지 않고 즉시 중단한다. 초기 목표는 350MB 이하.
  · 비밀번호/커넥션 문자열은 로그에 출력하지 않는다(SUPABASE_DB_URL 은 환경에서만 사용).

실행:
  SUPABASE_DB_URL 을 scripts/hw-similarity/.env.local 에서 로드 후
  .venv/bin/python load_to_supabase.py            (전체)
  .venv/bin/python load_to_supabase.py --only embeddings   (특정 테이블만)
"""
from __future__ import annotations
import argparse, io, json, os, sys
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(ROOT, "data", "processed")
LEX = os.path.join(PROC, "lexicon")
EMB = os.path.join(ROOT, "data", "embeddings")
ENV = os.path.join(os.path.dirname(os.path.dirname(ROOT)), "scripts", "hw-similarity", ".env.local")

MB = 1024 * 1024


def load_env():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url and os.path.exists(ENV):
        with open(ENV) as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_DB_URL="):
                    url = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not url:
        sys.exit("SUPABASE_DB_URL 미설정 — .env.local 확인")
    return url


def db_size_mb(conn) -> float:
    with conn.cursor() as cur:
        cur.execute("select pg_database_size(current_database())")
        return cur.fetchone()[0] / MB


def guard(conn, hard_stop: float, step: str) -> bool:
    """적재 전 용량 확인. hard_stop 도달 시 False(중단)."""
    sz = db_size_mb(conn)
    if sz >= hard_stop:
        print(f"  ⛔ [{step}] DB {sz:.1f}MB ≥ 한도 {hard_stop:.0f}MB — 신규 적재 중단(§9)")
        return False
    print(f"  · [{step}] 적재 전 DB {sz:.1f}MB")
    return True


def copy_rows(conn, table: str, columns: list[str], rows_iter):
    """psycopg COPY 로 대량 적재. rows_iter 는 컬럼 순서의 튜플들."""
    cols = ", ".join(columns)
    n = 0
    with conn.cursor() as cur:
        with cur.copy(f"copy public.{table} ({cols}) from stdin") as cp:
            for row in rows_iter:
                cp.write_row(row)
                n += 1
    conn.commit()
    return n


def load_vocab() -> set:
    vocab = set()
    with open(os.path.join(LEX, "words.jsonl"), encoding="utf-8") as f:
        for line in f:
            vocab.add(json.loads(line)["word"])
    return vocab


# ── 각 테이블 로더 (row 제너레이터) ──
def gen_words():
    with open(os.path.join(LEX, "words.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            yield (r["word"], r["freq"], r["freq_written"], r["freq_spoken"], bool(r["usable"]))


def gen_senses():
    # PK=(word, sense_id). 같은 sense_id 가 여러 pos 로 집계될 수 있으므로 병합(최다빈도 pos, 합산 cnt).
    agg: dict[tuple, list] = {}
    with open(os.path.join(LEX, "word_senses.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            k = (r["word"], r["sense_id"])
            cnt = int(r.get("count", 0))
            if k not in agg:
                agg[k] = [r["pos"], cnt, cnt]  # [대표pos, 대표pos의 cnt, 총 cnt]
            else:
                a = agg[k]
                a[2] += cnt
                if cnt > a[1]:
                    a[0], a[1] = r["pos"], cnt
    for (word, sid), (pos, _, total) in agg.items():
        yield (word, sid, pos, total)


def gen_categories():
    seen = set()
    with open(os.path.join(LEX, "word_categories.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            k = (r["word"], r["category"])
            if k in seen:
                continue
            seen.add(k)
            yield (r["word"], r["category"], r["via"])


def gen_relations(vocab):
    kept = 0
    with open(os.path.join(PROC, "relations.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r["a"] in vocab and r["b"] in vocab:
                kept += 1
                yield (r["a"], r["b"], r["rel"], r["dir"], float(r["strength"]))
    print(f"    (관계 간선 어휘내 {kept:,})")


def gen_cooc(vocab):
    path = os.path.join(PROC, "cooccurrence.jsonl")
    if not os.path.exists(path):
        print("    ⚠ cooccurrence.jsonl 없음 — Phase 4 미완? 건너뜀")
        return
    kept = 0
    with open(path, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r["a"] in vocab and r["b"] in vocab:
                kept += 1
                yield (r["a"], r["b"], float(r["npmi"]))
    print(f"    (공생쌍 어휘내 {kept:,})")


def gen_embeddings(vocab):
    kept = 0
    # 비등방성 제거(평균차감) 임베딩이 있으면 우선 사용(center_embeddings.py 산출)
    src = os.path.join(EMB, "nouns.centered.vec.jsonl")
    if not os.path.exists(src):
        src = os.path.join(EMB, "nouns.vec.jsonl")
    print(f"    (임베딩 소스: {os.path.basename(src)})")
    with open(src, encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            w = r["word"] if "word" in r else r.get("w")
            if w not in vocab:
                continue
            vec = r["vec"] if "vec" in r else r.get("v")
            kept += 1
            yield (w, "[" + ",".join(f"{x:.4f}" for x in vec) + "]")
    print(f"    (임베딩 어휘내 {kept:,})")


STEPS = {
    "words":      ("hw_words", ["word", "freq", "freq_written", "freq_spoken", "usable"], lambda v: gen_words()),
    "senses":     ("hw_word_senses", ["word", "sense_id", "pos", "cnt"], lambda v: gen_senses()),
    "categories": ("hw_word_categories", ["word", "category", "via"], lambda v: gen_categories()),
    "relations":  ("hw_word_relations", ["a", "b", "rel", "dir", "strength"], gen_relations),
    "cooc":       ("hw_word_cooc", ["a", "b", "npmi"], gen_cooc),
    "embeddings": ("hw_word_embeddings", ["word", "vec"], gen_embeddings),
}
ORDER = ["words", "senses", "categories", "relations", "cooc", "embeddings"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", nargs="*", choices=ORDER, help="특정 단계만 적재")
    ap.add_argument("--hard-stop", type=float, default=400.0, help="DB 총사용량 상한(MB)")
    ap.add_argument("--truncate", action="store_true", help="적재 전 해당 테이블 truncate")
    args = ap.parse_args()

    url = load_env()
    steps = args.only or ORDER
    vocab = load_vocab()
    print(f"어휘 {len(vocab):,} 로드")

    with psycopg.connect(url) as conn:
        print(f"시작 DB {db_size_mb(conn):.1f}MB · 한도 {args.hard_stop:.0f}MB")
        for name in steps:
            table, cols, gen = STEPS[name]
            if not guard(conn, args.hard_stop, name):
                break
            if args.truncate:
                with conn.cursor() as cur:
                    cur.execute(f"truncate public.{table} cascade")
                conn.commit()
            n = copy_rows(conn, table, cols, gen(vocab))
            print(f"  ✓ {table}: {n:,} 행 · 적재 후 DB {db_size_mb(conn):.1f}MB")
        print(f"최종 DB {db_size_mb(conn):.1f}MB")


if __name__ == "__main__":
    main()
