-- 0023 · 배포 전 데블스 플랜 '테스트 데이터' 초기화.
-- 스키마와 출연자 시드(devil_contestants 16명)는 유지하고, 플레이 중 생성되는 동적 데이터만 비운다.
-- (관리자 role로 실행 → RLS 우회. 앱에선 탈락자 삭제가 막혀 있어 여기서만 정리 가능.)
delete from public.devil_trade_offers;
delete from public.devil_trades;
delete from public.devil_predictions;
delete from public.devil_eliminations;
delete from public.devil_watch;
delete from public.devil_spoiler_consent;
update public.devil_final set winner_contestant_id = null, updated_at = now() where id = true;
