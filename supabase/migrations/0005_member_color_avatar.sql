-- 0005 · 멤버 표시색(color) + 아바타 스토리지 버킷
-- color: 달력에서 그 멤버를 나타내는 색(팔레트 6색 중 택1). 기존 멤버엔 가입순으로 기본색 배정.
-- avatars: 프로필 사진 저장용 public 버킷. 경로는 {uid}/... 로, 본인 폴더만 쓰기 가능.

-- 1) members.color
alter table public.members add column if not exists color text;
grant update (color) on public.members to authenticated;

-- 기존 멤버 기본색(가입순 로테이션) — color 비어있는 행만
with ranked as (
  select id, (row_number() over (order by joined_at) - 1) as idx from public.members
),
pal as (
  select array['#2140E0','#E8318A','#00B9F2','#80C341','#FCAF16','#7A5AF8'] as c
)
update public.members m
set color = pal.c[(r.idx % 6) + 1]
from ranked r, pal
where m.id = r.id and m.color is null;

-- 2) 아바타 버킷 + 정책
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
