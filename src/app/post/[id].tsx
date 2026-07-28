/**
 * 표지 상세 — 월별 표지(사진+글) + 댓글. 담당자/관리자는 표지를 편집할 수 있다.
 * 루트 스택에 푸시되는 화면(탭 위). 상단에 뒤로가기.
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { MentionInput } from '@/components/MentionInput';
import { CoverEditModal, type CoverSubmit } from '@/features/host/CoverEditModal';
import { colors, radius, space } from '@/theme/tokens';
import { parseMentionIds } from '@/lib/mentions';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { getPost, updateCover, uploadCoverImage, uploadCoverVideo } from '@/api/hosts';
import { addComment, listComments } from '@/api/comments';
import { notifyMembers } from '@/api/notifications';

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const { data: post } = useQuery({ queryKey: ['post', id], queryFn: () => getPost(id), enabled: !!id });
  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: comments = [] } = useQuery({ queryKey: ['comments', id], queryFn: () => listComments(id), enabled: !!id });

  const canEdit = !!post && (!!me?.is_admin || post.member_id === userId);

  const coverMut = useMutation({
    mutationFn: async (v: CoverSubmit) => {
      let mediaUrl: string | undefined;
      if (userId && v.base64) mediaUrl = await uploadCoverImage(userId, v.base64, Date.now());
      else if (userId && v.videoUri) mediaUrl = await uploadCoverVideo(userId, v.videoUri, Date.now());
      await updateCover(id, {
        cover_message: v.message.trim() ? v.message.trim() : null,
        ...(mediaUrl ? { cover_image_url: mediaUrl } : {}),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['post', id] });
      qc.invalidateQueries({ queryKey: ['monthly-posts'] });
      setEditing(false);
    },
    onError: (e) => alertErr(e),
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      await addComment(id, userId, draft);
      const nick = me?.nickname ?? '멤버';
      await notifyMembers(userId, members.map((m) => m.id), 'comment', `${nick}님이 표지에 코멘트를 남겼어요: ${draft.trim()}`);
      const mentioned = parseMentionIds(draft, members);
      if (mentioned.length) await notifyMembers(userId, mentioned, 'mention', `${nick}님이 회원님을 언급했어요: ${draft.trim()}`);
    },
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['comments', id] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    },
    onError: (e) => alertErr(e),
  });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* 상단바 */}
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="h2">‹ 뒤로</Text>
        </Pressable>
        {canEdit ? (
          <Pressable onPress={() => setEditing(true)} hitSlop={12}>
            <Text variant="bodyBold" color={colors.light.cobalt}>표지 편집</Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!post ? (
          <ActivityIndicator style={{ marginTop: space.section }} color={colors.light.cobalt} />
        ) : (
          <>
            {post.cover_image_url && isVideoUrl(post.cover_image_url) ? (
              <Pressable style={[styles.cover, styles.coverEmpty]} onPress={() => Linking.openURL(post.cover_image_url as string)}>
                <Text variant="h2" color={colors.light.cobalt}>▶ 동영상 보기</Text>
              </Pressable>
            ) : post.cover_image_url ? (
              <Image source={{ uri: post.cover_image_url }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverEmpty]}>
                <Text variant="mono" color={colors.light.textSecondary}>표지 없음</Text>
              </View>
            )}
            <Text variant="kicker" color={colors.light.textSecondary} style={{ marginTop: space.lg }}>
              {post.year}년 {post.month}월 · 담당 {post.nickname}
            </Text>
            <Text variant="body" style={{ marginTop: space.sm, fontSize: 17, lineHeight: 26 }}>
              {post.cover_message?.trim() || '아직 표지 글이 없어요.'}
            </Text>

            {/* 댓글 */}
            <View style={styles.commentHead}>
              <Text variant="kicker" color={colors.light.textSecondary}>코멘트 {comments.length}</Text>
            </View>
            {comments.map((c) => (
              <View key={c.id} style={styles.comment}>
                {c.avatar_url ? (
                  <Image source={{ uri: c.avatar_url }} style={styles.cAvatar} />
                ) : (
                  <View style={[styles.cAvatar, { backgroundColor: c.color ?? colors.light.mist }]}>
                    <Text variant="caption" color={colors.light.paper}>{c.nickname.slice(0, 1)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="caption" color={colors.light.textSecondary}>{c.nickname}</Text>
                  <Text variant="body">{c.body}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 ? (
              <Text variant="bodySm" color={colors.light.textSecondary} style={{ paddingVertical: space.md }}>
                첫 코멘트를 남겨보세요.
              </Text>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* 댓글 입력 (@맨션) */}
      {userId ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.inputBar}>
            <MentionInput value={draft} onChangeText={setDraft} members={members} placeholder="코멘트 (@로 멤버 언급)" style={{ flex: 1 }} />
            <Button label="등록" onPress={() => draft.trim() && commentMut.mutate()} loading={commentMut.isPending} style={styles.sendBtn} />
          </View>
        </KeyboardAvoidingView>
      ) : null}

      <CoverEditModal
        visible={editing}
        initialMessage={post?.cover_message ?? null}
        initialImage={post?.cover_image_url ?? null}
        saving={coverMut.isPending}
        onClose={() => setEditing(false)}
        onSubmit={(v) => coverMut.mutate(v)}
      />
    </SafeAreaView>
  );
}

function alertErr(e: unknown) {
  Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');
}

const isVideoUrl = (url: string) => /\.(mp4|mov|m4v)(\?|$)/i.test(url);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.screen,
    height: 48,
  },
  content: { paddingHorizontal: space.screen, paddingBottom: space.section },
  cover: { width: '100%', height: 220, borderRadius: radius.card, backgroundColor: colors.light.surfacePlate },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  commentHead: { marginTop: space.section, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.light.hairline, marginBottom: space.sm },
  comment: { flexDirection: 'row', gap: space.md, paddingVertical: space.sm },
  cAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.screen,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.light.hairline,
    backgroundColor: colors.light.paper,
  },
  sendBtn: { height: 48, paddingHorizontal: space.lg },
});
