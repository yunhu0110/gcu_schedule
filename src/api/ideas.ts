/**
 * 아이디어 창고 — 가보고 싶은 곳/하고 싶은 것. 읽기 전체, 작성/삭제 본인.
 */
import { supabase } from '@/lib/supabase';

export type Idea = {
  id: string;
  member_id: string;
  body: string;
  created_at: string;
  nickname: string;
  color: string | null;
};

type Raw = { id: string; member_id: string; body: string; created_at: string; members: { nickname: string; color: string | null } | null };

export async function listIdeas(): Promise<Idea[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select('id, member_id, body, created_at, members(nickname, color)')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    body: r.body,
    created_at: r.created_at,
    nickname: r.members?.nickname ?? '?',
    color: r.members?.color ?? null,
  }));
}

export async function addIdea(memberId: string, body: string): Promise<void> {
  const { error } = await supabase.from('ideas').insert({ member_id: memberId, body: body.trim() });
  if (error) throw error;
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await supabase.from('ideas').delete().eq('id', id);
  if (error) throw error;
}
