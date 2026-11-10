/**
 * 데블스 플랜 쿼리/뮤테이션 — supabase 접근은 여기서만.
 * 스포일러 차단은 서버 RLS로 강제된다(09-DEVIL-RULES §12):
 *  - devil_eliminations SELECT는 '내 연속 시청 범위' 이하 회차만 반환(미시청 회차는 응답에 없음).
 *  - devil_final SELECT는 전체 시청 완료 / 별도 동의 / 관리자만 반환.
 * 저장 성격의 작업은 트랜잭션 RPC(devil_save_watch / devil_set_picks / devil_trade)로.
 */
import { supabase } from '@/lib/supabase';

export type DevilContestant = { id: number; name: string; sort: number };
export type Prediction = { member_id: string; contestant_id: number };
export type Elimination = { contestant_id: number; episode: number };

/** 출연자 16명(공개) */
export async function listContestants(): Promise<DevilContestant[]> {
  const { data, error } = await supabase
    .from('devil_contestants')
    .select('id, name, sort')
    .order('sort', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DevilContestant[];
}

/** 전체 참여자 예측(모든 멤버 픽). 멤버 닉네임 조인. */
export type PredictionRow = { member_id: string; contestant_id: number; nickname: string };
export async function listPredictions(): Promise<PredictionRow[]> {
  const { data, error } = await supabase
    .from('devil_predictions')
    .select('member_id, contestant_id, members(nickname)');
  if (error) throw error;
  return ((data ?? []) as unknown as { member_id: string; contestant_id: number; members: { nickname: string } | null }[])
    .map((r) => ({ member_id: r.member_id, contestant_id: r.contestant_id, nickname: r.members?.nickname ?? '?' }));
}

/** 내 픽(0~2명) */
export async function getMyPicks(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('devil_predictions')
    .select('contestant_id')
    .eq('member_id', userId);
  if (error) throw error;
  return ((data ?? []) as { contestant_id: number }[]).map((r) => r.contestant_id);
}

/** 최초 예측 저장(정확히 2명). 이미 배정/탈락 출연자는 서버에서 거부. */
export async function setMyPicks(ids: number[]): Promise<void> {
  const { error } = await supabase.rpc('devil_set_picks', { p_ids: ids });
  if (error) throw error;
}

/** 내 시청 완료 회차 집합 */
export async function getMyWatch(userId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('devil_watch')
    .select('episode')
    .eq('member_id', userId);
  if (error) throw error;
  return ((data ?? []) as { episode: number }[]).map((r) => r.episode);
}

/** 시청 기록 저장('시청 완료 등록하기' 버튼). 전달한 회차 집합으로 교체. */
export async function saveWatch(episodes: number[]): Promise<void> {
  const { error } = await supabase.rpc('devil_save_watch', { p_eps: episodes });
  if (error) throw error;
}

/** 회차 시청 현황 — 전원의 (회차·누가·언제 등록) 목록. 결과가 아니므로 스포일러 아님. */
export type WatchStatusRow = { member_id: string; nickname: string; episode: number; watched_at: string };
export async function listWatchStatus(): Promise<WatchStatusRow[]> {
  const { data, error } = await supabase.rpc('devil_watch_status');
  if (error) throw error;
  return (data ?? []) as WatchStatusRow[];
}

/** 1화부터 연속 시청 완료한 최대 회차(결과 공개 범위) — 클라 계산. */
export function watchThrough(episodes: number[]): number {
  const set = new Set(episodes);
  let n = 0;
  while (set.has(n + 1)) n += 1;
  return n;
}

/** 탈락 결과 — RLS로 '내 시청 범위 이하' 회차만 반환된다. */
export async function listVisibleEliminations(): Promise<Elimination[]> {
  const { data, error } = await supabase
    .from('devil_eliminations')
    .select('contestant_id, episode')
    .order('episode', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Elimination[];
}

/** 탈락자 등록(먼저 본 사람 누구나). */
export async function registerElimination(episode: number, contestantId: number, userId: string): Promise<void> {
  const { error } = await supabase
    .from('devil_eliminations')
    .insert({ episode, contestant_id: contestantId, registered_by: userId });
  if (error) throw error;
}

/** 최종 우승자 — 공개 조건 미충족 시 null(RLS로 행 자체가 안 옴). */
export async function getFinalWinner(): Promise<number | null> {
  const { data, error } = await supabase
    .from('devil_final')
    .select('winner_contestant_id')
    .maybeSingle();
  if (error) throw error;
  return (data as { winner_contestant_id: number | null } | null)?.winner_contestant_id ?? null;
}

/** 최종 결과 공개 가능 여부(14화 완료/동의/관리자). */
export async function canSeeFinal(userId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('devil_can_see_final', { p_uid: userId });
  if (error) throw error;
  return data === true;
}

/** 최종 스포일러 동의 등록. */
export async function giveFinalConsent(userId: string): Promise<void> {
  const { error } = await supabase
    .from('devil_spoiler_consent')
    .insert({ member_id: userId });
  if (error && error.code !== '23505') throw error; // 중복(이미 동의)은 무시
}

/** 최종 우승자 등록(마지막 화에서 먼저 본 사람 누구나). */
export async function setWinner(contestantId: number): Promise<void> {
  const { error } = await supabase.rpc('devil_set_winner', { p_id: contestantId });
  if (error) throw error;
}

/** 트레이드 — 내 out 을 FA in 으로 교체. */
export async function trade(outId: number, inId: number): Promise<void> {
  const { error } = await supabase.rpc('devil_trade', { p_out: outId, p_in: inId });
  if (error) throw error;
}

export type TradeRow = { id: string; member_id: string; out_contestant_id: number; in_contestant_id: number; created_at: string; nickname: string };
export async function listTrades(): Promise<TradeRow[]> {
  const { data, error } = await supabase
    .from('devil_trades')
    .select('id, member_id, out_contestant_id, in_contestant_id, created_at, members(nickname)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as (Omit<TradeRow, 'nickname'> & { members: { nickname: string } | null })[])
    .map((r) => ({ ...r, nickname: r.members?.nickname ?? '?' }));
}

// ── 상대와의 트레이드 신청(수락 기반) ──────────────────────────────
export type TradeOffer = {
  id: string;
  proposer_id: string;
  target_id: string;
  offer_contestant_id: number;   // 신청자가 내놓는 선수
  request_contestant_id: number; // 신청자가 원하는(상대 보유) 선수
  cash: number;                  // 신청자가 얹는 현금(제안용). 0이면 선수 대 선수.
  status: 'pending' | 'accepted' | 'rejected' | 'canceled';
  created_at: string;
  proposer_nick: string;
  target_nick: string;
};

type OfferRaw = Omit<TradeOffer, 'proposer_nick' | 'target_nick'> & {
  proposer: { nickname: string } | null;
  target: { nickname: string } | null;
};

/** 나와 관련된(보낸/받은) 트레이드 신청. RLS로 당사자만 조회된다. */
export async function listTradeOffers(): Promise<TradeOffer[]> {
  const { data, error } = await supabase
    .from('devil_trade_offers')
    .select('id, proposer_id, target_id, offer_contestant_id, request_contestant_id, cash, status, created_at, proposer:members!devil_trade_offers_proposer_id_fkey(nickname), target:members!devil_trade_offers_target_id_fkey(nickname)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as OfferRaw[]).map((r) => ({
    id: r.id, proposer_id: r.proposer_id, target_id: r.target_id,
    offer_contestant_id: r.offer_contestant_id, request_contestant_id: r.request_contestant_id,
    cash: r.cash ?? 0, status: r.status, created_at: r.created_at,
    proposer_nick: r.proposer?.nickname ?? '?', target_nick: r.target?.nickname ?? '?',
  }));
}

/** 나와 시청 진도(연속 범위)가 같은 참여자 id 목록 — 이들과만 P2P 트레이드 가능. */
export async function listSyncMemberIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('devil_members_in_sync');
  if (error) throw error;
  return ((data ?? []) as { member_id: string }[]).map((r) => r.member_id);
}

/** 트레이드 신청: 내 선수(offer) ↔ 상대 보유 선수(request) (+ 현금 제안). */
export async function proposeTrade(offerId: number, requestId: number, cash: number): Promise<void> {
  const { error } = await supabase.rpc('devil_propose_trade', { p_offer: offerId, p_request: requestId, p_cash: cash });
  if (error) throw error;
}
export async function acceptTradeOffer(offerRowId: string): Promise<void> {
  const { error } = await supabase.rpc('devil_accept_trade', { p_id: offerRowId });
  if (error) throw error;
}
export async function rejectTradeOffer(offerRowId: string): Promise<void> {
  const { error } = await supabase.rpc('devil_reject_trade', { p_id: offerRowId });
  if (error) throw error;
}
export async function cancelTradeOffer(offerRowId: string): Promise<void> {
  const { error } = await supabase.rpc('devil_cancel_trade', { p_id: offerRowId });
  if (error) throw error;
}
