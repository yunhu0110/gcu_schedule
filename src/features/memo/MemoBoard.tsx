/**
 * MemoBoard — 홈 메모장(메신저형). 글 작성/수정/삭제 + 대댓글(1단계) + 작성 시간.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';
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
      <Text variant="bodyBold" style={{ fontSize: 15, marginBottom: space.sm }}>낙서장</Text>

      <TextField value={draft} onChangeText={setDraft} style={styles.inputField} />
      <Button label="작성" onPress={() => draft.trim() && addMut.mutate({ body: draft, parentId: null })} loading={addMut.isPending} style={styles.sendBtn} />

      {memos.map((m) => <Bubble key={m.id} memo={m} userId={userId} onChange={invalidate} onError={onErr} />)}
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

  // 내 글만: 꾹 누르면 수정/삭제 메뉴
  function openMenu() {
    if (!mine) return;
    Alert.alert('낙서', undefined, [
      { text: '수정', onPress: () => setEditing(true) },
      { text: '삭제', style: 'destructive', onPress: () => run(() => deleteMemo(memo.id)) },
      { text: '취소', style: 'cancel' },
    ]);
  }

  return (
    <View style={[styles.bubbleWrap, isReply && styles.replyIndent]}>
      <Pressable style={styles.bubbleRow} onLongPress={openMenu} delayLongPress={300}>
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
              <TextField value={editText} onChangeText={setEditText} style={styles.inlineField} />
              <Button label="저장" onPress={() => editText.trim() && run(() => updateMemo(memo.id, editText), () => setEditing(false))} style={styles.miniBtn} />
            </View>
          ) : (
            <Text variant="bodySm">{memo.body}</Text>
          )}
          {!isReply ? (
            <Text variant="caption" color={colors.light.action} onPress={() => setReplying((v) => !v)} style={styles.replyLink}>답글</Text>
          ) : null}
        </View>
      </Pressable>

      {replying ? (
        <View style={[styles.replyInput, styles.replyIndent]}>
          <TextField value={reply} onChangeText={setReply} placeholder="답글" style={styles.inlineField} />
          <Button label="등록" onPress={() => reply.trim() && run(() => addMemo(userId, reply, memo.id), () => { setReply(''); setReplying(false); })} style={styles.miniBtn} />
        </View>
      ) : null}

      {memo.replies.map((r) => <Bubble key={r.id} memo={r} userId={userId} onChange={onChange} onError={onError} isReply />)}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.light.hairline },
  // 밑줄만 있는 모던 입력 (네모 박스 아님)
  inputField: {
    height: 44,
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderColor: colors.light.hairlineStrong,
    borderRadius: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    fontSize: 15,
  },
  inlineField: { flex: 1, height: 40, fontSize: 14 },
  sendBtn: { alignSelf: 'flex-end', height: 38, paddingHorizontal: space.lg, marginTop: space.sm },
  bubbleWrap: { marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.light.hairline },
  replyIndent: { marginLeft: space.xl, borderTopWidth: 0, paddingTop: 0 },
  bubbleRow: { flexDirection: 'row', gap: space.sm },
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bubble: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  replyInput: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm, marginLeft: space.xl },
  replyLink: { marginTop: space.xs },
  miniBtn: { height: 40, paddingHorizontal: space.md },
});
