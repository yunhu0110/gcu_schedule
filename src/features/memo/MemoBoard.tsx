/**
 * MemoBoard — 홈 낙서장. 글 작성/수정/삭제 + 대댓글(1단계) + 작성 시간.
 * 위에서부터 제목 → 글(최신 10개, 더보기로 확장) → 입력칸+작성 버튼(한 줄).
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { MentionInput } from '@/components/MentionInput';
import { MentionText } from '@/components/MentionText';
import { ActionModal } from '@/components/ActionModal';
import { useScreenScroll } from '@/components/Screen';
import { colors, radius, space } from '@/theme/tokens';
import { formatDateTime } from '@/lib/date';
import { parseMentionIds } from '@/lib/mentions';
import { addMemo, deleteMemo, listMemos, updateMemo, type Memo } from '@/api/memos';
import { listMembers, type Member } from '@/api/members';
import { notifyMembers } from '@/api/notifications';

/** 낙서장에서 언급된 멤버에게 알림. */
async function notifyMentions(actorId: string, actorNick: string, body: string, members: Member[]) {
  const ids = parseMentionIds(body, members);
  if (ids.length) await notifyMembers(actorId, ids, 'mention', `${actorNick}님이 낙서장에서 회원님을 언급했어요: ${body.trim()}`);
}

const PAGE = 10; // 처음엔 최신 10개, 더보기마다 10개씩

export function MemoBoard({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const scrollRef = useScreenScroll();
  const [draft, setDraft] = useState('');
  const [visible, setVisible] = useState(PAGE);

  const { data: memos = [] } = useQuery({ queryKey: ['memos'], queryFn: listMemos, enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const myNick = members.find((m) => m.id === userId)?.nickname ?? '멤버';
  const invalidate = () => qc.invalidateQueries({ queryKey: ['memos'] });
  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  // 키보드가 입력칸을 가리지 않게: Screen이 키보드 높이만큼 하단 여유를 만들어 두므로(스크롤 여유),
  // 여기선 포커스/키보드 표시 시점에 맨 아래로 스크롤해 입력칸을 키보드 위로 올린다.
  const composing = useRef(false);
  useEffect(() => {
    const show = () => { if (composing.current) setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 80); };
    const sub = Keyboard.addListener('keyboardDidShow', show);
    return () => sub.remove();
  }, [scrollRef]);
  const onComposeFocus = () => { composing.current = true; setTimeout(() => scrollRef?.current?.scrollToEnd({ animated: true }), 80); };
  const onComposeBlur = () => { composing.current = false; };

  const addMut = useMutation({
    mutationFn: async (v: { body: string; parentId: string | null }) => {
      await addMemo(userId, v.body, v.parentId);
      await notifyMentions(userId, myNick, v.body, members);
    },
    onSuccess: () => { setDraft(''); invalidate(); qc.invalidateQueries({ queryKey: ['unread'] }); },
    onError: onErr,
  });

  const shown = memos.slice(0, visible);
  const hasMore = memos.length > visible;

  return (
    <View style={styles.card}>
      <Text variant="h2" style={{ marginBottom: space.sm }}>낙서장</Text>

      {shown.map((m) => <Bubble key={m.id} memo={m} userId={userId} members={members} myNick={myNick} onChange={invalidate} onError={onErr} />)}

      {hasMore ? (
        <Pressable style={styles.moreBtn} onPress={() => setVisible((v) => v + PAGE)}>
          <Text variant="bodySm" color={colors.light.textSecondary}>더보기</Text>
        </Pressable>
      ) : null}

      <View style={styles.composeRow}>
        <View style={styles.grow}>
          <MentionInput value={draft} onChangeText={setDraft} members={members} placeholder="작성 (@로 멤버 언급)" inputStyle={styles.inputField} onFocus={onComposeFocus} onBlur={onComposeBlur} />
        </View>
        <Button label="작성" onPress={() => draft.trim() && addMut.mutate({ body: draft, parentId: null })} loading={addMut.isPending} style={styles.sendBtn} />
      </View>
    </View>
  );
}

function Bubble({ memo, userId, members, myNick, onChange, onError, isReply }: { memo: Memo; userId: string; members: Member[]; myNick: string; onChange: () => void; onError: (e: unknown) => void; isReply?: boolean }) {
  const qc = useQueryClient();
  const mine = memo.member_id === userId;
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(memo.body);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const run = (fn: () => Promise<void>, after?: () => void) =>
    fn().then(() => { qc.invalidateQueries({ queryKey: ['memos'] }); onChange(); after?.(); }).catch(onError);

  // 내 글만: 꾹 누르면 수정/삭제 메뉴
  function openMenu() {
    if (mine) setMenuOpen(true);
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
              <View style={styles.grow}>
                <TextField value={editText} onChangeText={setEditText} style={styles.inlineField} />
              </View>
              <Button label="저장" onPress={() => editText.trim() && run(() => updateMemo(memo.id, editText), () => setEditing(false))} style={styles.miniBtn} />
            </View>
          ) : (
            <MentionText body={memo.body} members={members} variant="bodySm" />
          )}
          {!isReply ? (
            <Text variant="caption" color={colors.light.action} onPress={() => setReplying((v) => !v)} style={styles.replyLink}>답글</Text>
          ) : null}
        </View>
      </Pressable>

      {replying ? (
        <View style={[styles.replyInput, styles.replyIndent]}>
          <View style={styles.grow}>
            <MentionInput value={reply} onChangeText={setReply} members={members} placeholder="답글 (@로 언급)" inputStyle={styles.inlineField} />
          </View>
          <Button
            label="등록"
            onPress={() => reply.trim() && run(
              async () => { await addMemo(userId, reply, memo.id); await notifyMentions(userId, myNick, reply, members); },
              () => { setReply(''); setReplying(false); },
            )}
            style={styles.miniBtn}
          />
        </View>
      ) : null}

      {memo.replies.map((r) => <Bubble key={r.id} memo={r} userId={userId} members={members} myNick={myNick} onChange={onChange} onError={onError} isReply />)}

      {menuOpen ? (
        <ActionModal
          visible={menuOpen}
          title="낙서"
          actions={[
            { label: '수정', onPress: () => setEditing(true) },
            { label: '삭제', destructive: true, onPress: () => run(() => deleteMemo(memo.id)) },
            { label: '취소', cancel: true },
          ]}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xl, paddingTop: space.lg },
  grow: { flex: 1 },
  // 글 목록 아래 한 줄 입력: 밑줄만 있는 모던 입력 + 작성 버튼
  composeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
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
  inlineField: { height: 40, fontSize: 14 },
  sendBtn: { height: 44, paddingHorizontal: space.lg },
  moreBtn: {
    alignSelf: 'center',
    marginTop: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.light.hairlineStrong,
  },
  bubbleWrap: { marginTop: space.md, paddingTop: space.md },
  replyIndent: { marginLeft: space.xl, paddingTop: 0 },
  bubbleRow: { flexDirection: 'row', gap: space.sm, userSelect: 'none' }, // 웹에서 텍스트 선택이 꾹 누르기를 먹지 않게
  avatar: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bubble: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  editRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  replyInput: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm, marginLeft: space.xl },
  replyLink: { marginTop: space.xs },
  miniBtn: { height: 40, paddingHorizontal: space.md },
});
