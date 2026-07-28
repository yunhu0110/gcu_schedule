/**
 * 댓글 쿼리 함수 — 월별 표지(hosts) 대상. 읽기는 활성 멤버 전체, 작성/삭제는 본인.
 */
import { supabase } from '@/lib/supabase';

export type Comment = {
  id: string;
  member_id: string;
  body: string;
  created_at: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
};

type Raw = {
  id: string;
  member_id: string;
  body: string;
  created_at: string;
  members: { nickname: string; avatar_url: string | null; color: string | null } | null;
};

/** 표지의 댓글 — 오래된 순. */
export async function listComments(hostId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('id, member_id, body, created_at, members(nickname, avatar_url, color)')
    .eq('host_id', hostId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    body: r.body,
    created_at: r.created_at,
    nickname: r.members?.nickname ?? '?',
    avatar_url: r.members?.avatar_url ?? null,
    color: r.members?.color ?? null,
  }));
}

export async function addComment(hostId: string, memberId: string, body: string): Promise<void> {
  const { error } = await supabase.from('comments').insert({ host_id: hostId, member_id: memberId, body: body.trim() });
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw error;
}
