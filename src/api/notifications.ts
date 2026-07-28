/**
 * 알림 쿼리 함수 — 본인 수신 알림 조회/읽음 + 다른 멤버에게 fan-out.
 * 6인 신뢰 그룹이라 생성은 클라이언트가 actor=본인으로 직접 insert.
 */
import { supabase } from '@/lib/supabase';

export type Noti = {
  id: string;
  type: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function listNotifications(userId: string): Promise<Noti[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, body, created_at, read_at')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as Noti[];
}

export async function unreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/** 나(actor)를 제외한 수신자들에게 같은 알림을 fan-out. */
export async function notifyMembers(actorId: string, recipientIds: string[], type: string, body: string): Promise<void> {
  const rows = recipientIds.filter((id) => id !== actorId).map((id) => ({ recipient_id: id, actor_id: actorId, type, body }));
  if (rows.length === 0) return;
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) throw error;
}
