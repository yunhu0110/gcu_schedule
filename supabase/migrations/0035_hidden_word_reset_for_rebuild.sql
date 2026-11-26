-- 0035 · 히든워드 전면 재구축을 위한 초기화 (지시서 1-3)
-- 백업 선행: apps/hidden-word/data/backups/ (COPY+gzip, backup_manifest.json).
--   data_audit_before_reset.json 로 초기화 전 스냅샷 기록 완료.
--
-- 대상(잘못된/구버전 데이터 정리):
--   (A) 구 유사도 3축 데이터 테이블 — 새 설계(words/word_senses/word_embeddings/
--       word_relations/word_cooccurrence)로 전면 대체되므로 DROP.
--   (B) 테스트 게임 데이터 — 전부 임시 테스트분이라 TRUNCATE.
--
-- 주의: 게임 플로우 RPC(hw_create_room 등)와 게임 테이블 '구조'는 유지한다(Phase 8에서 재정비).
--       hw_submit_guess 가 참조하는 hw_similarity 는 (A) 드롭으로 깨지므로
--       임시 null 스텁으로 재정의해 재구축 기간에도 앱이 에러 없이 동작하게 둔다.
--       → 데이터 미적재 상태의 기존 '현행 무변화' 동작과 동일(점수 null).

-- (A) 구 3축 데이터 테이블 제거 (RPC가 의존하므로 먼저 스텁으로 치환)
create or replace function public.hw_similarity(p_a text, p_b text)
returns numeric
language sql immutable
as $$ select null::numeric $$;   -- 재구축용 임시 스텁(Phase 7에서 신규 엔진으로 대체)

revoke all on function public.hw_similarity(text, text) from anon, authenticated;

drop table if exists public.hw_word_vectors cascade;
drop table if exists public.hw_word_cooc    cascade;
drop table if exists public.hw_word_relations cascade;

-- (B) 테스트 게임 데이터 비우기 (구조 유지)
truncate table
  public.hw_guesses,
  public.hw_clues,
  public.hw_player_words,
  public.hw_player_secrets,
  public.hw_pieces,
  public.hw_envelopes,
  public.hw_players,
  public.hw_rooms
cascade;
