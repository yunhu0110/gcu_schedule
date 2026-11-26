"""
히든 워드 유사도 파이프라인 공통 유틸.
- Supabase Postgres 직결 (SUPABASE_DB_URL 환경변수, 직접 연결 문자열)
- 히든워드 '풀' 단어 로드 (public.hw_word_pool — 단일 출처)
- 단어 정규화 / 명사 판별

주의(보안): 이 스크립트는 로컬에서 수동 실행하는 '운영 도구'다.
service_role 성격의 DB 커넥션 스트링을 쓰므로 절대 앱 코드/EAS/저장소에 커밋하지 않는다.
연결 정보는 환경변수로만 주입한다.
"""
from __future__ import annotations
import os
import re
import psycopg


def db() -> psycopg.Connection:
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise SystemExit(
            "SUPABASE_DB_URL 환경변수가 필요합니다.\n"
            "  Supabase 대시보드 > Project Settings > Database > Connection string (URI)\n"
            "  예: export SUPABASE_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'"
        )
    return psycopg.connect(url, autocommit=False)


def pool_words(conn: psycopg.Connection) -> list[str]:
    """hw_word_pool(1..11) 의 모든 단어(히든워드 후보) — 정규화해 유일 집합으로."""
    out: set[str] = set()
    with conn.cursor() as cur:
        for i in range(1, 12):
            cur.execute("select unnest(public.hw_word_pool(%s))", (i,))
            for (w,) in cur.fetchall():
                out.add(normalize(w))
    return sorted(out)


_WS = re.compile(r"\s+")


def normalize(w: str) -> str:
    """RPC(hw_similarity)의 lower(trim(...)) 와 동일 규칙으로 맞춘다."""
    return _WS.sub("", (w or "").strip().lower())


# kiwipiepy 로더(지연 초기화) — 명사 판별/토큰화 공용
_kiwi = None


def kiwi():
    global _kiwi
    if _kiwi is None:
        from kiwipiepy import Kiwi
        _kiwi = Kiwi()
    return _kiwi


def is_single_noun(word: str) -> bool:
    """단어가 '단일 명사(NNG/NNP)'로 분석되면 True. 어휘 사전 필터링용."""
    w = normalize(word)
    if not w or not re.fullmatch(r"[가-힣]{1,}", w):
        return False
    toks = kiwi().tokenize(w)
    return len(toks) == 1 and toks[0].tag in ("NNG", "NNP")
