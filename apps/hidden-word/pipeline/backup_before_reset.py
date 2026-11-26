"""
backup_before_reset.py — 초기화 전 논리 백업 (지시서 1-3.2/1-3.3)

pg_dump/supabase CLI 부재 → psycopg COPY ... TO STDOUT + gzip 으로 테이블별 백업.
- 작은/비재생성 테이블(관계·공생·게임데이터)은 전체 데이터 백업.
- hw_word_vectors(449MB, 재생성 가능·새 설계로 대체)는 스키마 DDL + 행수만 기록(용량/시간 절약).
산출: apps/hidden-word/data/backups/<table>.copy.gz + backup_manifest.json

※ 연결문자열/비밀번호는 출력/저장하지 않는다.
"""
from __future__ import annotations
import gzip, io, json, os, re
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUTDIR = os.path.join(ROOT, "data", "backups")

FULL = [  # 전체 데이터 백업
    "hw_word_relations", "hw_word_cooc",
    "hw_rooms", "hw_players", "hw_envelopes", "hw_clues", "hw_guesses",
    "hw_player_words", "hw_pieces", "hw_player_secrets",
]
SCHEMA_ONLY = ["hw_word_vectors"]  # 재생성 가능 → DDL+행수만


def table_ddl(cur, name: str) -> dict:
    cur.execute("""
      select column_name, data_type, is_nullable
      from information_schema.columns
      where table_schema='public' and table_name=%s order by ordinal_position
    """, (name,))
    cols = [{"name": r[0], "type": r[1], "nullable": r[2]} for r in cur.fetchall()]
    cur.execute(f"select count(*) from public.{name}")
    return {"columns": cols, "rows": cur.fetchone()[0]}


def copy_gz(conn, name: str, path: str) -> int:
    buf = io.BytesIO()
    with conn.cursor() as cur, gzip.open(path, "wb") as gz:
        with cur.copy(f"copy public.{name} to stdout with (format csv, header true)") as cp:
            for data in cp:
                gz.write(bytes(data))
    return os.path.getsize(path)


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    conn = psycopg.connect(os.environ["SUPABASE_DB_URL"], connect_timeout=20)
    manifest = {"created_purpose": "히든워드 전면 재구축 초기화 전 백업", "tables": {}}
    with conn.cursor() as cur:
        for name in FULL + SCHEMA_ONLY:
            ddl = table_ddl(cur, name)
            entry = {"ddl": ddl}
            if name in FULL:
                path = os.path.join(OUTDIR, f"{name}.copy.gz")
                size = copy_gz(conn, name, path)
                entry["data_file"] = os.path.basename(path)
                entry["data_file_bytes"] = size
                entry["backup_mode"] = "full"
                print(f"  ✓ {name:22} {ddl['rows']:>8}행 → {os.path.basename(path)} ({size//1024} kB)")
            else:
                entry["backup_mode"] = "schema_only (재생성 가능·새 설계로 대체)"
                print(f"  ✓ {name:22} {ddl['rows']:>8}행 → 스키마+행수만")
            manifest["tables"][name] = entry
    conn.close()
    mpath = os.path.join(OUTDIR, "backup_manifest.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"백업 매니페스트 → {mpath}")


if __name__ == "__main__":
    main()
