-- 0002 · 초대코드 폐지 + 단순 회원가입 전환 (ADR-009)
-- 이미 구 0001(members + invite_codes)이 적용된 hosted DB를 단순 가입 모델로 맞춘다.
-- 신규 설치(0001_init_members.sql만 적용된 DB)에도 안전한 idempotent 스크립트.

-- 1) members: 본인 id로만 self-insert 허용 (단순 가입 — auth.signUp 후 세션 상태에서 insert)
drop policy if exists members_insert_self on public.members;
create policy members_insert_self on public.members
  for insert with check (id = auth.uid());
grant insert (id, nickname, avatar_url) on public.members to authenticated;

-- 2) 초대코드 폐지: 테이블/정책 제거 (join Edge Function은 저장소에서 이미 삭제)
drop table if exists public.invite_codes cascade;
