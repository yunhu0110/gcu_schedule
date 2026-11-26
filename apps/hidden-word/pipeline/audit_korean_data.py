"""
audit_korean_data.py — 원본 데이터 전수 감사 + 기존 DB 데이터 감사 (읽기 전용)

지시서 1-1(원본 조사) + 1-3.1/1-3.4(DB 스키마 조사 + data_audit_before_reset.json) 충족.
- korean 원본 폴더를 재귀 조사: 데이터셋명/크기/파일수/형식/라이선스PDF/허용목록 매칭.
- 보조 데이터(우리말샘 opendict, fastText) 소재 확인.
- Supabase DB(SUPABASE_DB_URL) 테이블 목록/행수/크기 + 초기화 대상/유지 대상 분류.
- 산출: apps/hidden-word/data/manifests/data_audit_before_reset.json

※ 비밀번호/연결문자열은 출력/저장하지 않는다(프로젝트 ref만 기록).
※ 원본은 읽기만 한다. 초기화·삭제는 하지 않는다(별도 승인 후 별도 스크립트).
"""
from __future__ import annotations
import json, os, re, glob
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # apps/hidden-word
KOREAN = os.path.join(ROOT, "korean")
OUT = os.path.join(ROOT, "data", "manifests", "data_audit_before_reset.json")

# 지시서 1-2 허용 목록(표준화 키)
ALLOWED = {
    "dict": ["표준국어대사전", "한국어기초사전", "우리말샘"],
    "relation": ["NIKLex"],
    "corpus": ["문어 말뭉치 2025", "일상 대화 말뭉치 2025", "형태 분석 말뭉치 2025",
               "어휘 의미 분석 말뭉치 2025", "한국어 다층위 구조 분석 말뭉치 2025",
               "일상 대화 말뭉치 추출 지식그래프 2025"],
}
# 폴더명 → 허용목록 매핑(실측 기준)
FOLDER_MAP = {
    "NIKL_WRITTEN_2025_v1.0": ("corpus", "문어 말뭉치 2025"),
    "NIKL_DIALOGUE_2025_v1.0": ("corpus", "일상 대화 말뭉치 2025"),
    "NIKL_MP_2025_v1.0": ("corpus", "형태 분석 말뭉치 2025"),
    "NIKL_Korean_Multi-layered_Structural_Analysis_Corpus_2025_v1.0":
        ("corpus", "한국어 다층위 구조 분석 말뭉치 2025"),
    "국립국어원 어휘 관계 자료 NIKLex(버전 1.0)": ("relation", "NIKLex"),
}


def dir_size(path: str) -> int:
    tot = 0
    for dp, _, files in os.walk(path):
        for fn in files:
            try:
                tot += os.path.getsize(os.path.join(dp, fn))
            except OSError:
                pass
    return tot


def ext_hist(path: str) -> dict:
    c = Counter()
    for dp, _, files in os.walk(path):
        for fn in files:
            c[os.path.splitext(fn)[1].lower().lstrip(".")] += 1
    return dict(c.most_common())


def audit_korean() -> list[dict]:
    rows = []
    if not os.path.isdir(KOREAN):
        return rows
    for name in sorted(os.listdir(KOREAN)):
        sub = os.path.join(KOREAN, name)
        if not os.path.isdir(sub):
            continue
        cat, allowed_name = FOLDER_MAP.get(name, (None, None))
        pdfs = [os.path.basename(p) for p in glob.glob(os.path.join(sub, "**", "*.pdf"), recursive=True)]
        rows.append({
            "folder": name,
            "size_bytes": dir_size(sub),
            "size_mb": round(dir_size(sub) / 1024 / 1024, 1),
            "file_count": sum(len(f) for _, _, f in os.walk(sub)),
            "ext_histogram": ext_hist(sub),
            "license_docs_pdf": pdfs,
            "allowed_category": cat,
            "allowed_name": allowed_name,
            "in_allowlist": allowed_name is not None,
        })
    return rows


def audit_aux() -> dict:
    repo = os.path.dirname(os.path.dirname(ROOT))  # gcu_schedule
    opendict = glob.glob(os.path.join(repo, "scripts", "hw-similarity", "data", "opendict", "*.xml"))
    ft = glob.glob(os.path.join(ROOT, "data", "raw", "cc.ko.*.vec*")) + \
         glob.glob(os.path.join(ROOT, "data", "raw", "*fasttext*"))
    return {
        "urimalsaem_opendict_xml": {
            "present": bool(opendict), "count": len(opendict),
            "location": "scripts/hw-similarity/data/opendict/",
            "note": "우리말샘(허용목록 사전). GitHub spellcheck-ko 미러 다운로드본(공식 NIKL 다운로드 아님). korean/ 폴더 밖.",
        },
        "fasttext": {
            "present": bool(ft), "files": [os.path.basename(p) for p in ft],
            "location": "apps/hidden-word/data/raw/",
            "note": "cc.ko.300 사전학습 벡터. 지시서 5-2 '확보된 fastText 모델' 조건 충족 가능.",
        },
        "missing_from_allowlist": [
            "표준국어대사전 (korean/ 에 없음)",
            "한국어기초사전 (korean/ 에 없음)",
            "어휘 의미 분석 말뭉치 2025 (korean/ 에 없음)",
            "일상 대화 말뭉치 추출 지식그래프 2025 (korean/ 에 없음)",
        ],
    }


def audit_db() -> dict:
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        return {"error": "SUPABASE_DB_URL 미설정 — DB 감사 건너뜀"}
    import psycopg
    ref = re.search(r'postgres\.([a-z0-9]{20})', url)
    conn = psycopg.connect(url, connect_timeout=15)
    cur = conn.cursor()
    cur.execute("select pg_database_size(current_database())")
    db_bytes = cur.fetchone()[0]
    cur.execute("""
      select c.relname, pg_total_relation_size(c.oid), coalesce(s.n_live_tup,0)
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      left join pg_stat_user_tables s on s.relid=c.oid
      where n.nspname='public' and c.relkind='r'
      order by pg_total_relation_size(c.oid) desc
    """)
    # 초기화(재구축) 대상 vs 유지 분류
    RESET = {"hw_word_vectors", "hw_word_cooc", "hw_word_relations"}  # 데이터축(새 명세로 재구축)
    GAME_TEST = {"hw_rooms", "hw_players", "hw_envelopes", "hw_clues", "hw_guesses",
                 "hw_player_words", "hw_pieces", "hw_player_secrets"}  # 테스트 게임 데이터
    tables = []
    for name, size, rows in cur.fetchall():
        cls = "RESET_축데이터" if name in RESET else (
            "RESET_테스트게임" if name in GAME_TEST else "KEEP")
        tables.append({"table": name, "total_bytes": size,
                       "size_pretty": f"{round(size/1024/1024,2)} MB" if size >= 1024*1024 else f"{size//1024} kB",
                       "rows": rows, "classification": cls})
    conn.close()
    return {
        "project_ref": ref.group(1) if ref else None,
        "host": re.search(r'@([^:/]+)', url).group(1),
        "db_size_bytes": db_bytes,
        "db_size_mb": round(db_bytes / 1024 / 1024, 1),
        "free_tier_limit_mb": 500,
        "tables": tables,
    }


def main():
    audit = {
        "schema_version": 1,
        "purpose": "히든워드 전면 재구축 전 원본·DB 감사(초기화 전 스냅샷)",
        "korean_root": KOREAN,
        "allowlist": ALLOWED,
        "korean_datasets": audit_korean(),
        "auxiliary_data": audit_aux(),
        "database": audit_db(),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(audit, f, ensure_ascii=False, indent=2)
    print(f"감사 완료 → {OUT}")
    # 요약 출력
    print("\n[원본 데이터셋]")
    for d in audit["korean_datasets"]:
        mark = "✓허용" if d["in_allowlist"] else "⚠미매칭"
        print(f"  {mark}  {d['folder']}  {d['size_mb']}MB  {d['file_count']}파일  {d['ext_histogram']}")
    print("\n[누락(허용목록이나 미보유)]")
    for m in audit["auxiliary_data"]["missing_from_allowlist"]:
        print("  -", m)
    db = audit["database"]
    if "tables" in db:
        print(f"\n[DB {db['db_size_mb']}MB / ref {db['project_ref']}] 초기화 대상:")
        for t in db["tables"]:
            if t["classification"].startswith("RESET"):
                print(f"  {t['classification']:18} {t['table']:22} {t['size_pretty']:>9} {t['rows']}행")


if __name__ == "__main__":
    main()
