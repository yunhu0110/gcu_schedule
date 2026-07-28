-- 0004 · 가용성에 시간대(선택) 추가. start_time/end_time 이 null 이면 '하루 종일'.
-- 상태는 불가/가능 2종만 실사용(enum의 maybe는 남겨두되 앱에서 노출하지 않음).

alter table public.availabilities add column if not exists start_time time;
alter table public.availabilities add column if not exists end_time time;

-- upsert(insert/update) payload에 시간 컬럼 포함 → 컬럼 권한 부여(누적).
grant insert (member_id, date, status, note, start_time, end_time) on public.availabilities to authenticated;
grant update (member_id, date, status, note, start_time, end_time) on public.availabilities to authenticated;
