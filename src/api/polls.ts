/**
 * 날짜 투표 — 그 달 담당자가 후보 날짜로 투표를 열고, 멤버는 가능한 날에 투표.
 * 담당자는 결과를 보고 최종 날짜를 확정한다.
 */
import { supabase } from '@/lib/supabase';
import type { DateStr } from '@/lib/date';

export type PollOption = {
  id: string;
  date: DateStr;
  voters: { member_id: string; nickname: string; color: string | null }[];
};
export type Poll = {
  id: string;
  year: number;
  month: number;
  host_id: string;
  status: string;
  deadline: DateStr | null;
  confirmed_date: DateStr | null;
  options: PollOption[];
};

/** 삭제된 투표 표시값 — delete 권한이 없는 환경에서의 폴백(deletePoll 참조). */
const DELETED = 'deleted';

/** (year, month)의 가장 최근 투표 + 옵션 + 투표자. 없으면 null. */
export async function getPoll(year: number, month: number): Promise<Poll | null> {
  const { data: polls, error } = await supabase
    .from('date_polls')
    .select('id, year, month, host_id, status, deadline, confirmed_date')
    .eq('year', year)
    .eq('month', month)
    .neq('status', DELETED)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const poll = polls?.[0];
  if (!poll) return null;

  const { data: opts, error: oErr } = await supabase
    .from('date_poll_options')
    .select('id, date')
    .eq('poll_id', poll.id)
    .order('date', { ascending: true });
  if (oErr) throw oErr;
  const optionIds = (opts ?? []).map((o) => o.id);

  let votes: { option_id: string; member_id: string; members: { nickname: string; color: string | null } | null }[] = [];
  if (optionIds.length) {
    const { data: v, error: vErr } = await supabase
      .from('date_poll_votes')
      .select('option_id, member_id, members(nickname, color)')
      .in('option_id', optionIds);
    if (vErr) throw vErr;
    votes = (v ?? []) as unknown as typeof votes;
  }

  return {
    ...(poll as Omit<Poll, 'options'>),
    options: (opts ?? []).map((o) => ({
      id: o.id,
      date: o.date,
      voters: votes
        .filter((vt) => vt.option_id === o.id)
        .map((vt) => ({ member_id: vt.member_id, nickname: vt.members?.nickname ?? '?', color: vt.members?.color ?? null })),
    })),
  };
}

/** 홈에서 달을 넘겨 볼 때 쓰는 전체 요약(월별 확정 날짜). 삭제된 건 제외, 최신 먼저. */
export type PollBrief = {
  id: string;
  year: number;
  month: number;
  host_id: string;
  status: string;
  confirmed_date: DateStr | null;
};

export async function listPolls(): Promise<PollBrief[]> {
  const { data, error } = await supabase
    .from('date_polls')
    .select('id, year, month, host_id, status, confirmed_date')
    .neq('status', DELETED)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as PollBrief[];
}

/** 담당자/관리자: 그 달 확정 날짜를 지운다(미정으로 되돌림). 투표는 다시 진행 중으로. */
export async function clearConfirmedDate(year: number, month: number): Promise<void> {
  const { data, error } = await supabase
    .from('date_polls')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .neq('status', DELETED)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const id = data?.[0]?.id as string | undefined;
  if (!id) return;
  const { error: uErr } = await supabase
    .from('date_polls')
    .update({ confirmed_date: null, status: 'open' })
    .eq('id', id);
  if (uErr) throw uErr;
}

/** 담당자: 후보 날짜들로 투표 생성. */
export async function createPoll(hostId: string, year: number, month: number, dates: DateStr[], deadline: DateStr | null): Promise<string> {
  const { data: poll, error } = await supabase
    .from('date_polls')
    .insert({ year, month, host_id: hostId, status: 'open', deadline })
    .select('id')
    .single();
  if (error) throw error;
  const pollId = poll.id as string;
  const rows = dates.map((d) => ({ poll_id: pollId, date: d }));
  if (rows.length) {
    const { error: oErr } = await supabase.from('date_poll_options').insert(rows);
    if (oErr) throw oErr;
  }
  return pollId;
}

/** 멤버: 이 투표에서 내 표를 selectedOptionIds로 교체(가능한 날 다중 선택). */
export async function castVote(memberId: string, allOptionIds: string[], selectedOptionIds: string[]): Promise<void> {
  if (allOptionIds.length) {
    const { error: dErr } = await supabase.from('date_poll_votes').delete().eq('member_id', memberId).in('option_id', allOptionIds);
    if (dErr) throw dErr;
  }
  if (selectedOptionIds.length) {
    const rows = selectedOptionIds.map((id) => ({ option_id: id, member_id: memberId }));
    const { error: iErr } = await supabase.from('date_poll_votes').insert(rows);
    if (iErr) throw iErr;
  }
}

/** 담당자: 최종 날짜 확정 + 투표 종료. */
export async function confirmDate(pollId: string, date: DateStr): Promise<void> {
  const { error } = await supabase.from('date_polls').update({ confirmed_date: date, status: 'closed' }).eq('id', pollId);
  if (error) throw error;
}

/** 투표 작성자: 날짜 확정 없이 투표만 종료. */
export async function closePoll(pollId: string): Promise<void> {
  const { error } = await supabase.from('date_polls').update({ status: 'closed' }).eq('id', pollId);
  if (error) throw error;
}

/**
 * 투표 작성자/관리자: 투표를 통째로 삭제. 옵션·표는 FK cascade로 함께 사라진다.
 * date_polls의 delete 권한(0015 마이그레이션) 이전 환경에서는 status='deleted'로 숨긴다.
 */
export async function deletePoll(pollId: string): Promise<void> {
  const { error, count } = await supabase.from('date_polls').delete({ count: 'exact' }).eq('id', pollId);
  if (!error && count) return;
  const { error: uErr } = await supabase.from('date_polls').update({ status: DELETED }).eq('id', pollId);
  if (uErr) throw error ?? uErr;
}

/** 담당자/관리자: 투표 없이 날짜를 바로 확정(픽스). 기존 poll 있으면 갱신, 없으면 생성 후 확정. */
export async function setConfirmedDate(hostId: string, year: number, month: number, date: DateStr): Promise<void> {
  const { data, error } = await supabase.from('date_polls').select('id').eq('year', year).eq('month', month).neq('status', DELETED).order('created_at', { ascending: false }).limit(1);
  if (error) throw error;
  let pollId = data?.[0]?.id as string | undefined;
  if (!pollId) {
    const { data: created, error: cErr } = await supabase.from('date_polls').insert({ year, month, host_id: hostId, status: 'closed' }).select('id').single();
    if (cErr) throw cErr;
    pollId = created.id as string;
  }
  await confirmDate(pollId, date);
}
