-- 0025 · 탈락자 등록 취소(삭제) 허용.
-- 등록이 '먼저 본 사람 누구나'이므로 취소도 활성 멤버 누구나 가능.
-- 단, 자신의 연속 시청 범위에서 보이는 회차만 삭제(범위 밖 미래 탈락은 못 건드림). 관리자는 전체.
drop policy if exists devil_elim_delete_gated on public.devil_eliminations;
create policy devil_elim_delete_gated on public.devil_eliminations for delete
  using (
    public.is_active_member()
    and (public.is_admin() or episode <= public.devil_watch_through(auth.uid()))
  );

grant delete on public.devil_eliminations to authenticated;
