/**
 * MemoBoard — 홈 메모장(메신저형). 글 작성/수정/삭제 + 대댓글(1단계) + 작성 시간.
 */
import { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme/tokens';
import { formatDateTime } from '@/lib/date';
import { addMemo, deleteMemo, listMemos, updateMemo, type Memo } from '@/api/memos';

export function MemoBoard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data: memos = [] } = useQuery({ queryKey: ['memos'], queryFn: listMemos, enabled: !!userId });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['memos'] });
  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  const addMut = useMutation({
    mutationFn: (v: { body: string; parentId: string | null }) => addMemo(userId, v.body, v.parentId),
    onSuccess: () => { setDraft(''); invalidate(); },
    onError: onErr,
  });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.emoji}>📝</Text>
        <Text variant="bodyBold" style={{ fontSize: 16 }}>메모장</Text>
      </View>

      <View style={styles.inputRow}>
        <TextField value={draft} onChangeText={setDraft} placeholder="메모 남기기" style={{ flex: 1 }} />
        <Button label="작성" onPress={() => draft.trim() && addMut.mutate({ body: draft, parentId: null })} loading={addMut.isPending} style={styles.sendBtn} />
      </View>

      {memos.length === 0 ? (
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.md }}>첫 메모를 남겨보세요.</Text>
      ) : (
        memos.map((m) => <Bubble key={m.id} memo={m} userId={userId} onChange={invalidate} onError={onErr} />)
      )}
    </View>
  );
}

function Bubble({ memo, userId, onChange, onError, isReply }: { memo: Memo; userId: string; onChange: () => void; onError: (e: unknown) => void; isReply?: boolean }) {
  const qc = useQueryClient();
  const mine = memo.member_id === userId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(memo.body);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');

  const run = (fn: () => Promise<void>, after?: () => void) =>
    fn().then(() => { qc.invalidateQueries({ queryKey: ['memos'] }); onChange(); after?.(); }).catch(onError);

  return (
    <View style={[styles.bubbleWrap, isReply && styles.replyIndent]}>
      <View style={styles.bubbleRow}>
        {memo.avatar_url ? (
          <Image source={{ uri: memo.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: memo.color ?? colors.light.mist }]}>
            <Text variant="caption" color={colors.light.paper}>{memo.nickname.slice(0, 1)}</Text>
          </View>
        )}
        <View style={styles.bubble}>
          <View style={styles.metaRow}>
            <Text variant="caption" color={colors.light.textSecondary}>{memo.nickname}</Text>
            <Text variant="caption" color={colors.light.textSecondary}>{formatDateTime(memo.created_at)}</Text>
          </View>
          {editing ? (
            <View style={styles.editRow}>
              <TextField value={editText} onChangeText={setEditText} style={{ flex: 1 }} />
              <Button label="저장" onPress={() => editText.trim() && run(() => updateMemo(memo.id, editText), () => setEditing(false))} style={styles.miniBtn} />
            </View>
          ) : (
            <Text variant="body">{memo.body}</Text>
          )}
          <View style={styles.actions}>
            {!isReply ? <Text variant="caption" color={colors.light.action} onPress={() => setReplying((v) => !v)}>답글</Text> : null}
            {mine ? <Text variant="caption" color={colors.light.textSecondary} onPress={() => setEditing((v) => !v)}>수정</Text> : null}
            {mine ? (
              <Text
                variant="caption"
                color={colors.light.danger}
                onPress={() => Alert.alert('삭제', '이 메모를 삭제할까요?', [{ text: '취소' }, { text: '삭제', style: 'destructive', onPress: () => run(() => deleteMemo(memo.id)) }])}
              >
                삭제
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {replying ? (
        <View style={[styles.replyInput, styles.replyIndent]}>
          <TextField value={reply} onChangeText={setReply} placeholder="답글" style={{ flex: 1 }} />
          <Button label="등록" onPress={() => reply.trim() && run(() => addMemo(userId, reply, memo.id), () => { setReply(''); setReplying(false); })} style={styles.miniBtn} />
        </View>
      ) : null}

      {memo.replies.map((r) => <Bubble key={r.id} memo={r} userId={userId} onChange={onChange} onError={onError} isReply />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.light.surfacePlate, borderRadius: radius.soft, padding: 18, marginTop: space.xl },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  emoji: { fontSize: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.md },
  sendBtn: { height: 48, paddingHorizontal: space.lg },
  bubbleWrap: { marginTop: space.md },
  replyIndent: { marginLeft: space.xl },
  bubbleRow: { flexDirection: 'row', gap: space.sm },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bubble: { flex: 1, backgroundColor: colors.light.paper, borderRadius: radius.card, padding: space.md },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  replyInput: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  miniBtn: { height: 44, paddingHorizontal: space.md },
});
