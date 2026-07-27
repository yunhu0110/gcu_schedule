/**
 * 멤버 쿼리 함수.
 */
import { supabase } from '@/lib/supabase';

export type Member = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  is_active: boolean;
  is_admin: boolean;
  joined_at: string;
};

/** 내 프로필 (auth.uid 기준) */
export async function getMyProfile(userId: string): Promise<Member | null> {
  const { data, error } = await supabase.from('members').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Member | null;
}

/** 활성 멤버 전체 */
export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('is_active', true)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Member[];
}
