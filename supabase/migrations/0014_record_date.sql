-- 0014 · 기록에 날짜(record_date) 추가. 기록 작성 시 날짜를 등록한다. year/month는 그룹핑용.
alter table public.records add column if not exists record_date date;
grant insert (record_date) on public.records to authenticated;
grant update (record_date) on public.records to authenticated;
