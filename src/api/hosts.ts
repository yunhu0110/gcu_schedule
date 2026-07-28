/**
 * 담당자(월별 모임장) 쿼리 함수. 지정은 관리자만(RLS). 읽기는 활성 멤버 전체.
 */
import { supabase } from '@/lib/supabase';

export type Host = {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
};

/** (year, month) 담당자 + 멤버 정보. 없으면 null. */
export async function getHost(year: number, month: number): Promise<Host | null> {
  const { data, error } = await supabase
    .from('hosts')
    .select('member_id, members(nickname, avatar_url, color)')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const m = (data as unknown as { member_id: string; members: { nickname: string; avatar_url: string | null; color: string | null } | null }).members;
  return {
    member_id: (data as { member_id: string }).member_id,
    nickname: m?.nickname ?? '?',
    avatar_url: m?.avatar_url ?? null,
    color: m?.color ?? null,
  };
}

/** 담당자 지정/변경(관리자). (year, month) upsert. */
export async function setHost(year: number, month: number, memberId: string): Promise<void> {
  const { error } = await supabase
    .from('hosts')
    .upsert({ year, month, member_id: memberId }, { onConflict: 'year,month' });
  if (error) throw error;
}
