/**
 * 게임(보드게임) — 운영자가 등록한 게임 목록. 카드를 누르면 url로 외부 브라우저 이동.
 * 등록/수정/삭제는 운영자(is_admin)만(RLS로 강제). 썸네일은 covers 버킷 재사용.
 */
import { supabase } from '@/lib/supabase';
import { uploadImageBase64 } from '@/lib/uploadImage';

export type Game = {
  id: string;
  member_id: string;
  title: string;
  url: string;
  description: string | null;
  genre: string | null;
  thumbnail_url: string | null;
  created_at: string;
  nickname: string;
  color: string | null;
};

type Raw = {
  id: string; member_id: string; title: string; url: string; description: string | null; genre: string | null; thumbnail_url: string | null; created_at: string;
  members: { nickname: string; color: string | null } | null;
};

const SELECT = 'id, member_id, title, url, description, genre, thumbnail_url, created_at, members(nickname, color)';
const toGame = (r: Raw): Game => ({
  id: r.id, member_id: r.member_id, title: r.title, url: r.url, description: r.description, genre: r.genre, thumbnail_url: r.thumbnail_url, created_at: r.created_at,
  nickname: r.members?.nickname ?? '?', color: r.members?.color ?? null,
});

/** url이 스킴 없이 들어오면 https:// 를 붙인다. */
export function normalizeUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** 전체 게임(최근 등록순). */
export async function listGames(): Promise<Game[]> {
  const { data, error } = await supabase.from('games').select(SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map(toGame);
}

export type GameInput = { title: string; url: string; description: string | null; genre: string | null; thumbnail_url: string | null };

export async function createGame(memberId: string, v: GameInput): Promise<void> {
  const { error } = await supabase.from('games').insert({
    member_id: memberId,
    title: v.title.trim(),
    url: normalizeUrl(v.url),
    description: v.description?.trim() || null,
    genre: v.genre?.trim() || null,
    thumbnail_url: v.thumbnail_url,
  });
  if (error) throw error;
}

export async function updateGame(id: string, v: GameInput): Promise<void> {
  const { error } = await supabase.from('games').update({
    title: v.title.trim(),
    url: normalizeUrl(v.url),
    description: v.description?.trim() || null,
    genre: v.genre?.trim() || null,
    thumbnail_url: v.thumbnail_url,
  }).eq('id', id);
  if (error) throw error;
}

export async function deleteGame(id: string): Promise<void> {
  const { error } = await supabase.from('games').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadGameThumbnail(userId: string, base64: string, ts: number): Promise<string> {
  return uploadImageBase64('covers', `${userId}/game_${ts}.jpg`, base64);
}
