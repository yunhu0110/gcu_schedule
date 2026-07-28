/**
 * 담당자(월별 모임장) + 월별 표지(기록 피드) 쿼리 함수.
 * 담당자 지정은 관리자만. 표지(사진+글) 편집은 그 달 담당자(또는 관리자). 읽기는 활성 멤버 전체.
 */
import { supabase } from '@/lib/supabase';
import { uploadImageBase64, uploadUri } from '@/lib/uploadImage';

export type Host = {
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
};

/** 월별 표지 1개(피드/상세 공용). */
export type MonthlyPost = {
  id: string;
  year: number;
  month: number;
  member_id: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
  cover_message: string | null;
  cover_image_url: string | null;
};

const SELECT = 'id, year, month, member_id, cover_message, cover_image_url, members(nickname, avatar_url, color)';

type Raw = {
  id: string;
  year: number;
  month: number;
  member_id: string;
  cover_message: string | null;
  cover_image_url: string | null;
  members: { nickname: string; avatar_url: string | null; color: string | null } | null;
};

function toPost(r: Raw): MonthlyPost {
  return {
    id: r.id,
    year: r.year,
    month: r.month,
    member_id: r.member_id,
    nickname: r.members?.nickname ?? '?',
    avatar_url: r.members?.avatar_url ?? null,
    color: r.members?.color ?? null,
    cover_message: r.cover_message,
    cover_image_url: r.cover_image_url,
  };
}

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
  const m = (data as unknown as { members: Host | null }).members;
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

/** 기록 피드 — 월별 표지 전체, 내림차순(최근 달 먼저). */
export async function listMonthlyPosts(): Promise<MonthlyPost[]> {
  const { data, error } = await supabase
    .from('hosts')
    .select(SELECT)
    .order('year', { ascending: false })
    .order('month', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toPost);
}

/** 표지 1개(상세). */
export async function getPost(id: string): Promise<MonthlyPost | null> {
  const { data, error } = await supabase.from('hosts').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toPost(data as unknown as Raw) : null;
}

/** 표지 편집(그 달 담당자/관리자) — 사진/글. */
export async function updateCover(id: string, patch: { cover_message?: string | null; cover_image_url?: string | null }): Promise<void> {
  const { error } = await supabase.from('hosts').update(patch).eq('id', id);
  if (error) throw error;
}

/** 표지 사진 업로드 → covers 버킷({uid}/...) → URL 반환(호출부에서 updateCover로 반영). */
export async function uploadCoverImage(userId: string, base64: string, ts: number): Promise<string> {
  return uploadImageBase64('covers', `${userId}/cover_${ts}.jpg`, base64);
}

/** 표지 동영상 업로드(base64 없이 uri→blob). 확장자로 동영상 여부를 판별하니 .mp4 로 저장. */
export async function uploadCoverVideo(userId: string, uri: string, ts: number): Promise<string> {
  return uploadUri('covers', `${userId}/cover_${ts}.mp4`, uri, 'video/mp4');
}
