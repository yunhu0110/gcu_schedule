-- 0015 · 투표 삭제. 마이페이지 투표 섹션에 "투표 삭제" 버튼이 생기면서 필요해졌다.
-- 삭제 가능 범위는 기존 date_polls_host_write 정책(작성자 또는 관리자)이 그대로 통제한다.
-- 옵션·표(date_poll_options / date_poll_votes)는 FK on delete cascade로 함께 지워진다.
grant delete on public.date_polls to authenticated;
