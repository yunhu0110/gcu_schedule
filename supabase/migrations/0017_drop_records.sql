-- 0017 · 기록 기능 폐지 — 게임(보드게임) 탭으로 교체되며 records/record_comments 미사용.
-- 앱에서 참조가 모두 제거됐고 데이터도 정리하기로 함(0016_games 참고).
drop table if exists public.record_comments cascade;
drop table if exists public.records cascade;
