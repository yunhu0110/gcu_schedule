/**
 * 기록 — 누구나 표지(사진/동영상 + 글)를 올리고 월별로 정리. 코멘트는 record_comments.
 */
import { supabase } from '@/lib/supabase';
import { uploadImageBase64, uploadUri } from '@/lib/uploadImage';

export type Record = {
  id: string;
  member_id: string;
  year: number;
  month: number;
  record_date: string | null;
  media_url: string | null;
  body: string | null;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
};

type Raw = {
  id: string; member_id: string; year: number; month: number; record_date: string | null; media_url: string | null; body: string | null; created_at: string;
  members: { nickname: string; avatar_url: string | null; color: string | null } | null;
};

const SELECT = 'id, member_id, year, month, record_date, media_url, body, created_at, members(nickname, avatar_url, color)';
const toRec = (r: Raw): Record => ({
  id: r.id, member_id: r.member_id, year: r.year, month: r.month, record_date: r.record_date, media_url: r.media_url, body: r.body, created_at: r.created_at,
  nickname: r.members?.nickname ?? '?', avatar_url: r.members?.avatar_url ?? null, color: r.members?.color ?? null,
});

/** 전체 기록(최근 달 → 과거). 화면에서 year/month로 그룹핑. */
export async function listRecords(): Promise<Record[]> {
  const { data, error } = await supabase.from('records').select(SELECT).order('year', { ascending: false }).order('month', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toRec);
}

export async function getRecord(id: string): Promise<Record | null> {
  const { data, error } = await supabase.from('records').select(SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toRec(data as unknown as Raw) : null;
}

export async function createRecord(memberId: string, recordDate: string, mediaUrl: string | null, body: string): Promise<void> {
  const year = Number(recordDate.slice(0, 4));
  const month = Number(recordDate.slice(5, 7));
  const { error } = await supabase.from('records').insert({ member_id: memberId, year, month, record_date: recordDate, media_url: mediaUrl, body: body.trim() || null });
  if (error) throw error;
}

export async function updateRecord(id: string, patch: { media_url?: string | null; body?: string | null; record_date?: string | null; year?: number; month?: number }): Promise<void> {
  const { error } = await supabase.from('records').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('records').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadRecordImage(userId: string, base64: string, ts: number): Promise<string> {
  return uploadImageBase64('covers', `${userId}/rec_${ts}.jpg`, base64);
}
export async function uploadRecordVideo(userId: string, uri: string, ts: number): Promise<string> {
  return uploadUri('covers', `${userId}/rec_${ts}.mp4`, uri, 'video/mp4');
}

// ── 코멘트 ──
export type RecordComment = { id: string; member_id: string; body: string; created_at: string; nickname: string; avatar_url: string | null; color: string | null };
type RawC = { id: string; member_id: string; body: string; created_at: string; members: { nickname: string; avatar_url: string | null; color: string | null } | null };

export async function listRecordComments(recordId: string): Promise<RecordComment[]> {
  const { data, error } = await supabase.from('record_comments').select('id, member_id, body, created_at, members(nickname, avatar_url, color)').eq('record_id', recordId).order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RawC[]).map((r) => ({ id: r.id, member_id: r.member_id, body: r.body, created_at: r.created_at, nickname: r.members?.nickname ?? '?', avatar_url: r.members?.avatar_url ?? null, color: r.members?.color ?? null }));
}

export async function addRecordComment(recordId: string, memberId: string, body: string): Promise<void> {
  const { error } = await supabase.from('record_comments').insert({ record_id: recordId, member_id: memberId, body: body.trim() });
  if (error) throw error;
}
