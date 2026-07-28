/**
 * 멤버 쿼리 함수. supabase 접근은 여기서만.
 */
import { supabase } from '@/lib/supabase';

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

/**
 * 프로필 사진 업로드 → avatars 버킷({uid}/...) → members.avatar_url 갱신.
 * base64는 expo-image-picker의 assets[0].base64. 캐시 회피를 위해 파일명에 ts를 붙인다.
 */
export async function uploadAvatar(userId: string, base64: string, ts: number): Promise<string> {
  const bytes = base64ToBytes(base64);
  const path = `${userId}/avatar_${ts}.jpg`;
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  const url = data.publicUrl;
  const { error: updErr } = await supabase.from('members').update({ avatar_url: url }).eq('id', userId);
  if (updErr) throw updErr;
  return url;
}

// base64 → Uint8Array (RN에 atob가 없을 수 있어 직접 디코드)
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    out[p++] = (a << 2) | (b >> 4);
    if (c !== -1 && i + 2 < clean.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1 && i + 3 < clean.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}
