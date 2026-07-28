/**
 * 멤버 쿼리 함수. supabase 접근은 여기서만.
 */
import { supabase } from '@/lib/supabase';
import { uploadImageBase64 } from '@/lib/uploadImage';

export type Member = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
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

/** 내 표시색 변경(달력에서 나를 나타내는 색) */
export async function updateMyColor(userId: string, color: string): Promise<void> {
  const { error } = await supabase.from('members').update({ color }).eq('id', userId);
  if (error) throw error;
}

/** 닉네임 변경 */
export async function updateMyNickname(userId: string, nickname: string): Promise<void> {
  const { error } = await supabase.from('members').update({ nickname: nickname.trim() }).eq('id', userId);
  if (error) throw error;
}

/** 프로필 사진 업로드 → avatars 버킷({uid}/...) → members.avatar_url 갱신. */
export async function uploadAvatar(userId: string, base64: string, ts: number): Promise<string> {
  const url = await uploadImageBase64('avatars', `${userId}/avatar_${ts}.jpg`, base64);
  const { error } = await supabase.from('members').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;
  return url;
}
