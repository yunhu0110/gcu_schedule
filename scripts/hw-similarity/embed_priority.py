"""
축1 · 의미 벡터 우선순위 적재 (KR-SBERT → public.hw_word_vectors, halfvec 768)

무료 티어(500MB) 안에서 '최대한 많이, 중요한 것 먼저' 적재한다.
 - priority_vocab.txt 는 이미 (풀 → 사전관계 보유 → 길이) 우선순위로 정렬돼 있다.
 - 그 순서 그대로 임베딩/적재하고, 배치마다 pg_database_size 를 확인해
   --budget-mb 에 도달하면 '안전하게 중단'한다. (한도 초과로 프로젝트가 막히는 것 방지)
 - 이미 적재된 단어는 건너뛴다(재실행/이어서 적재 가능).

실행:
  set -a; . ./.env.local; set +a
  python embed_priority.py --vocab priority_vocab.txt --budget-mb 450
"""
from __future__ import annotations
import argparse, os, time
import psycopg
from common import normalize

# 세션 pooler 가 유휴/네트워크로 소켓을 끊어도 빨리 감지하고 재연결하도록 keepalive.
_KEEPALIVE = dict(keepalives=1, keepalives_idle=20, keepalives_interval=10,
                  keepalives_count=3, connect_timeout=15)


def connect():
    url = os.environ["SUPABASE_DB_URL"]
    return psycopg.connect(url, autocommit=False, **_KEEPALIVE)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vocab", default="priority_vocab.txt")
    ap.add_argument("--model", default="snunlp/KR-SBERT-V40K-klueNLI-augSTS")
    ap.add_argument("--batch", type=int, default=512)
    ap.add_argument("--budget-mb", type=float, default=450.0,
                    help="pg_database_size 가 이 값(MB)에 도달하면 중단 (무료 500MB 대비 여유)")
    ap.add_argument("--limit", type=int, default=0, help="이번 실행에서 적재할 최대 행 수(0=무제한)")
    ap.add_argument("--check-every", type=int, default=5, help="N배치마다 DB 용량 확인")
    args = ap.parse_args()

    # 우선순위 순서 보존 + 중복 제거
    order, seen = [], set()
    with open(args.vocab, encoding="utf-8") as f:
        for line in f:
            w = normalize(line)
            if w and w not in seen:
                seen.add(w); order.append(w)
    print(f"우선순위 어휘 {len(order)}개 로드")

    conn = connect()
    cur = conn.cursor()
    cur.execute("select word from public.hw_word_vectors")
    done = {r[0] for r in cur.fetchall()}
    print(f"이미 적재됨 {len(done)}개 → 건너뜀")
    todo = [w for w in order if w not in done]
    print(f"적재 대상 {len(todo)}개")

    def db_mb() -> float:
        cur.execute("select pg_database_size(current_database())")
        return cur.fetchone()[0] / 1024 / 1024

    start_mb = db_mb()
    print(f"현재 DB 용량 {start_mb:.1f} MB / 예산 {args.budget_mb} MB")
    if start_mb >= args.budget_mb:
        print("이미 예산 도달 — 중단."); conn.close(); return

    import torch
    from sentence_transformers import SentenceTransformer
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    print(f"모델 로드… {args.model} (device={device})")
    model = SentenceTransformer(args.model, device=device)

    def vec_literal(arr) -> str:
        return "[" + ",".join(f"{x:.6f}" for x in arr) + "]"

    inserted = 0
    stop = False
    for bi, i in enumerate(range(0, len(todo), args.batch)):
        if stop:
            break
        chunk = todo[i:i + args.batch]
        if args.limit and inserted + len(chunk) > args.limit:
            chunk = chunk[: args.limit - inserted]
            stop = True
        if not chunk:
            break
        embs = model.encode(chunk, normalize_embeddings=True, show_progress_bar=False)
        rows = [(w, vec_literal(e), True) for w, e in zip(chunk, embs)]
        for attempt in range(1, 6):   # 끊김 시 재연결 재시도
            try:
                cur.executemany(
                    "insert into public.hw_word_vectors(word, vec, is_noun) "
                    "values (%s, %s::extensions.halfvec, %s) "
                    "on conflict (word) do update set vec = excluded.vec, is_noun = excluded.is_noun",
                    rows,
                )
                conn.commit()
                break
            except (psycopg.OperationalError, psycopg.InterfaceError) as e:
                print(f"  ⚠ 연결 끊김(시도 {attempt}): {str(e)[:60]} → 재연결", flush=True)
                try:
                    conn.close()
                except Exception:
                    pass
                time.sleep(2 * attempt)
                conn = connect(); cur = conn.cursor()
        else:
            print("★ 재시도 5회 실패 → 중단"); break
        inserted += len(chunk)
        if bi % args.check_every == 0:
            mb = db_mb()
            print(f"  적재 {inserted:>7} / 대상 {len(todo)}   DB {mb:7.1f} MB", flush=True)
            if mb >= args.budget_mb:
                print(f"★ 예산 {args.budget_mb} MB 도달 → 안전 중단 (적재 {inserted}개)")
                break

    cur.execute("select count(*) from public.hw_word_vectors")
    total = cur.fetchone()[0]
    print(f"완료. 이번 적재 {inserted}개, 테이블 총 {total}개, DB {db_mb():.1f} MB")
    conn.close()


if __name__ == "__main__":
    main()
