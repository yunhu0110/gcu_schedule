/**
 * 메모장(홈) — 글/대댓글(1단계). 작성/수정/삭제 본인, 읽기 전체.
 */
import { supabase } from '@/lib/supabase';

export type Memo = {
  id: string;
  member_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  nickname: string;
  avatar_url: string | null;
  color: string | null;
  replies: Memo[];
};

type Raw = {
  id: string;
  member_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  members: { nickname: string; avatar_url: string | null; color: string | null } | null;
};

/** 전체 메모(최신 상단) + 각 글의 대댓글(오래된 순). */
export async function listMemos(): Promise<Memo[]> {
  const { data, error } = await supabase
    .from('memos')
    .select('id, member_id, parent_id, body, created_at, updated_at, members(nickname, avatar_url, color)')
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  const rows = ((data ?? []) as unknown as Raw[]).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    parent_id: r.parent_id,
    body: r.body,
    created_at: r.created_at,
    updated_at: r.updated_at,
    nickname: r.members?.nickname ?? '?',
    avatar_url: r.members?.avatar_url ?? null,
    color: r.members?.color ?? null,
    replies: [] as Memo[],
  }));
  const byId = new Map(rows.map((m) => [m.id, m]));
  const top: Memo[] = [];
  for (const m of rows) {
    if (m.parent_id && byId.has(m.parent_id)) byId.get(m.parent_id)!.replies.push(m);
    else if (!m.parent_id) top.push(m);
  }
  top.reverse(); // 최신 글이 위로
  return top;
}

export async function addMemo(memberId: string, body: string, parentId: string | null = null): Promise<void> {
  const { error } = await supabase.from('memos').insert({ member_id: memberId, body: body.trim(), parent_id: parentId });
  if (error) throw error;
}

export async function updateMemo(id: string, body: string): Promise<void> {
  const { error } = await supabase.from('memos').update({ body: body.trim() }).eq('id', id);
  if (error) throw error;
}

export async function deleteMemo(id: string): Promise<void> {
  const { error } = await supabase.from('memos').delete().eq('id', id);
  if (error) throw error;
}
