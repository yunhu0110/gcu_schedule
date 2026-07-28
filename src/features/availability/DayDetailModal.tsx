/**
 * DayDetailModal — 날짜를 누르면 뜨는 상세: 그 날 누가 가능/불가한지 + 날짜 코멘트(@맨션).
 * 거기서 내 일정 입력/수정으로 넘어간다.
 */
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { MentionInput } from '@/components/MentionInput';
import { colors, radius, space } from '@/theme/tokens';
import { formatKo, type DateStr } from '@/lib/date';
import { parseMentionIds } from '@/lib/mentions';
import type { AvailRow } from '@/api/availabilities';
import type { Member } from '@/api/members';
import { addDayComment, listDayComments } from '@/api/comments';
import { notifyMembers } from '@/api/notifications';

type Props = {
  visible: boolean;
  date: DateStr | null;
  rows: AvailRow[];
  members: Member[];
  userId: string | null;
  onClose: () => void;
  onEdit: () => void;
};

const fmtTime = (s: string | null) => (s ? s.slice(0, 5) : null);
function timeLabel(r: AvailRow): string {
  const a = fmtTime(r.start_time);
  const b = fmtTime(r.end_time);
  return a && b ? `${a}–${b}` : '종일';
}

export function DayDetailModal({ visible, date, rows, members, userId, onClose, onEdit }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const available = rows.filter((r) => r.status === 'available');
  const unavailable = rows.filter((r) => r.status === 'unavailable');
  const answeredIds = new Set(rows.map((r) => r.member_id));
  const missing = members.filter((m) => !answeredIds.has(m.id));
  const myNick = members.find((m) => m.id === userId)?.nickname ?? '멤버';

  const { data: comments = [] } = useQuery({
    queryKey: ['day-comments', date],
    queryFn: () => listDayComments(date as string),
    enabled: !!date && !!userId,
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!userId || !date) return;
      await addDayComment(date, userId, draft);
      const mentioned = parseMentionIds(draft, members);
      const ids = members.map((m) => m.id);
      await notifyMembers(userId, ids, 'day_comment', `${myNick}님이 ${formatKo(date)}에 코멘트: ${draft.trim()}`);
      if (mentioned.length) await notifyMembers(userId, mentioned, 'mention', `${myNick}님이 회원님을 언급했어요: ${draft.trim()}`);
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['day-comments', date] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text variant="h2">{date ? formatKo(date) : ''}</Text>
          <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
            가능 {available.length} · 불가 {unavailable.length} · 미입력 {missing.length}
          </Text>

          <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Group title="가능" tint={colors.light.available}>
              {available.map((r) => <MemberLine key={r.member_id} color={r.color} avatar={r.avatar_url} name={r.nickname} right={timeLabel(r)} />)}
              {available.length === 0 && <Empty />}
            </Group>
            <Group title="불가" tint={colors.light.unavailable}>
              {unavailable.map((r) => <MemberLine key={r.member_id} color={r.color} avatar={r.avatar_url} name={r.nickname} right={r.note ? r.note : timeLabel(r)} />)}
              {unavailable.length === 0 && <Empty />}
            </Group>
            <Group title="미입력" tint={colors.light.slate}>
              {missing.map((m) => <MemberLine key={m.id} color={m.color} avatar={m.avatar_url} name={m.nickname} right="—" dim />)}
              {missing.length === 0 && <Empty />}
            </Group>

            {/* 코멘트 */}
            <View style={styles.cHead}>
              <Text variant="kicker" color={colors.light.textSecondary}>코멘트 {comments.length}</Text>
            </View>
            {comments.map((c) => (
              <View key={c.id} style={styles.cRow}>
                <View style={[styles.cDot, { backgroundColor: c.color ?? colors.light.cobalt }]} />
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.light.textSecondary}>{c.nickname}</Text>
                  <Text variant="bodySm">{c.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          {/* 코멘트 입력(@맨션) */}
          {userId ? (
            <View style={styles.inputRow}>
              <MentionInput value={draft} onChangeText={setDraft} members={members} placeholder="코멘트 (@로 멤버 언급)" style={{ flex: 1 }} />
              <Button label="등록" onPress={() => draft.trim() && commentMut.mutate()} loading={commentMut.isPending} style={styles.sendBtn} />
            </View>
          ) : null}

          <Button label="내 일정 입력 / 수정" block onPress={onEdit} style={{ marginTop: space.sm }} />
          <Button label="닫기" variant="ghost" block onPress={onClose} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Group({ title, tint, children }: { title: string; tint: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <View style={[styles.groupDot, { backgroundColor: tint }]} />
        <Text variant="kicker" color={colors.light.textSecondary}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function MemberLine({ color, avatar, name, right, dim }: { color: string | null; avatar: string | null; name: string; right: string; dim?: boolean }) {
  return (
    <View style={[styles.line, dim && { opacity: 0.55 }]}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: color ?? colors.light.mist }]}>
          <Text variant="caption" color={colors.light.paper}>{name.slice(0, 1)}</Text>
        </View>
      )}
      <Text variant="bodyBold" style={{ flex: 1, fontSize: 15 }}>{name}</Text>
      <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 12 }}>{right}</Text>
    </View>
  );
}

const Empty = () => (
  <Text variant="bodySm" color={colors.light.ink24} style={{ paddingVertical: space.xs }}>없음</Text>
);

const styles = StyleSheet.create({
  kav: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: { backgroundColor: colors.light.paper, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, padding: space.screen, paddingBottom: space.section },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  group: { marginTop: space.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 7 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cHead: { marginTop: space.lg, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.light.hairline, marginBottom: space.sm },
  cRow: { flexDirection: 'row', gap: space.sm, paddingVertical: 6 },
  cDot: { width: 7, height: 7, borderRadius: 3.5, marginTop: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.md },
  sendBtn: { height: 48, paddingHorizontal: space.lg },
});
