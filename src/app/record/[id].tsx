/**
 * 기록 상세 — 표지(사진/동영상) + 글 + 코멘트(@맨션). 작성자는 수정/삭제 가능.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { MentionInput } from '@/components/MentionInput';
import { ActionModal } from '@/components/ActionModal';
import { CoverEditModal, type CoverSubmit } from '@/features/host/CoverEditModal';
import { colors, radius, space } from '@/theme/tokens';
import { parseMentionIds } from '@/lib/mentions';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { listMembers } from '@/api/members';
import { addRecordComment, deleteRecord, getRecord, listRecordComments, updateRecord, uploadRecordImage, uploadRecordVideo } from '@/api/records';
import { notifyMembers } from '@/api/notifications';

const isVideoUrl = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url);

export default function RecordScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: rec } = useQuery({ queryKey: ['record', id], queryFn: () => getRecord(id), enabled: !!id });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: comments = [] } = useQuery({ queryKey: ['record-comments', id], queryFn: () => listRecordComments(id), enabled: !!id });

  const mine = !!rec && rec.member_id === userId;
  const myNick = members.find((m) => m.id === userId)?.nickname ?? '멤버';

  const editMut = useMutation({
    mutationFn: async (v: CoverSubmit) => {
      if (!userId) return;
      let mediaUrl: string | undefined;
      if (v.base64) mediaUrl = await uploadRecordImage(userId, v.base64, Date.now());
      else if (v.videoUri) mediaUrl = await uploadRecordVideo(userId, v.videoUri, Date.now());
      await updateRecord(id, {
        body: v.message.trim() || null,
        record_date: v.date,
        year: Number(v.date.slice(0, 4)),
        month: Number(v.date.slice(5, 7)),
        ...(mediaUrl ? { media_url: mediaUrl } : {}),
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['record', id] }); qc.invalidateQueries({ queryKey: ['records'] }); setEditing(false); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const delMut = useMutation({
    mutationFn: () => deleteRecord(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); router.back(); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await addRecordComment(id, userId, draft);
      await notifyMembers(userId, members.map((m) => m.id), 'record_comment', `${myNick}님이 기록에 코멘트를 남겼어요: ${draft.trim()}`);
      const mentioned = parseMentionIds(draft, members);
      if (mentioned.length) await notifyMembers(userId, mentioned, 'mention', `${myNick}님이 회원님을 언급했어요: ${draft.trim()}`);
    },
    onSuccess: () => { setDraft(''); qc.invalidateQueries({ queryKey: ['record-comments', id] }); qc.invalidateQueries({ queryKey: ['unread'] }); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function confirmDelete() {
    setDelOpen(true);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text variant="h2">‹ 뒤로</Text></Pressable>
        {mine ? (
          <View style={styles.topActions}>
            <Pressable onPress={() => setEditing(true)} hitSlop={10}><Text variant="bodyBold" color={colors.light.cobalt}>수정</Text></Pressable>
            <Pressable onPress={confirmDelete} hitSlop={10}><Text variant="bodyBold" color={colors.light.danger}>삭제</Text></Pressable>
          </View>
        ) : <View />}
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {!rec ? (
            <ActivityIndicator style={{ marginTop: space.section }} color={colors.light.cobalt} />
          ) : (
            <>
              {rec.media_url && isVideoUrl(rec.media_url) ? (
                <Pressable style={[styles.cover, styles.coverEmpty]} onPress={() => Linking.openURL(rec.media_url as string)}>
                  <Text variant="h2" color={colors.light.cobalt}>▶ 동영상 보기</Text>
                </Pressable>
              ) : rec.media_url ? (
                <Image source={{ uri: rec.media_url }} style={styles.cover} />
              ) : null}
              <Text variant="kicker" color={colors.light.textSecondary} style={{ marginTop: space.lg }}>{rec.year}년 {rec.month}월 · {rec.nickname} · {formatDateTime(rec.created_at)}</Text>
              <Text variant="body" style={{ marginTop: space.sm, fontSize: 17, lineHeight: 26 }}>{rec.body?.trim() || '내용이 없어요.'}</Text>

              <View style={styles.cHead}><Text variant="kicker" color={colors.light.textSecondary}>댓글 {comments.length}</Text></View>
              {comments.map((c) => (
                <View key={c.id} style={styles.comment}>
                  {c.avatar_url ? (
                    <Image source={{ uri: c.avatar_url }} style={styles.cAvatar} />
                  ) : (
                    <View style={[styles.cAvatar, { backgroundColor: c.color ?? colors.light.mist }]}><Text variant="caption" color={colors.light.paper}>{c.nickname.slice(0, 1)}</Text></View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" color={colors.light.textSecondary}>{c.nickname} · {formatDateTime(c.created_at)}</Text>
                    <Text variant="body">{c.body}</Text>
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {userId ? (
          <View style={styles.inputBar}>
            <MentionInput value={draft} onChangeText={setDraft} members={members} placeholder="댓글" style={{ flex: 1 }} />
            <Button label="등록" onPress={() => draft.trim() && commentMut.mutate()} loading={commentMut.isPending} style={styles.sendBtn} />
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <CoverEditModal
        visible={editing}
        initialMessage={rec?.body ?? null}
        initialImage={rec?.media_url ?? null}
        initialDate={rec?.record_date ?? null}
        saving={editMut.isPending}
        onClose={() => setEditing(false)}
        onSubmit={(v) => editMut.mutate(v)}
      />
      <ActionModal
        visible={delOpen}
        title="기록 삭제"
        message="이 기록을 삭제할까요?"
        actions={[
          { label: '삭제', destructive: true, onPress: () => delMut.mutate() },
          { label: '취소', cancel: true },
        ]}
        onClose={() => setDelOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  flex: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screen, height: 48 },
  topActions: { flexDirection: 'row', gap: space.lg },
  content: { paddingHorizontal: space.screen, paddingBottom: space.section },
  cover: { width: '100%', height: 220, borderRadius: radius.card, backgroundColor: colors.light.surfacePlate },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  cHead: { marginTop: space.section, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.light.hairline, marginBottom: space.sm },
  comment: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  cAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingHorizontal: space.screen, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.light.hairline, backgroundColor: colors.light.paper },
  sendBtn: { height: 48, paddingHorizontal: space.lg },
});
