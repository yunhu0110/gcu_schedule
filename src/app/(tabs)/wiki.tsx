/**
 * S4. 기록 — 월별 표지 피드. 매월 담당자가 표지(사진/동영상) + 글을 남기고 내림차순으로 쌓인다.
 * "기록하기"로 내가 담당인 달의 표지를 작성/수정한다. 표지를 누르면 상세 + 코멘트.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { CoverEditModal, type CoverSubmit } from '@/features/host/CoverEditModal';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { listMonthlyPosts, updateCover, uploadCoverImage, uploadCoverVideo, type MonthlyPost } from '@/api/hosts';

export default function RecordScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);

  const { data: posts = [] } = useQuery({ queryKey: ['monthly-posts'], queryFn: listMonthlyPosts, enabled: !!userId });

  const myPosts = posts.filter((p) => p.member_id === userId);
  const editing = posts.find((p) => p.id === editId) ?? null;

  const coverMut = useMutation({
    mutationFn: async (v: CoverSubmit) => {
      if (!editId || !userId) return;
      let mediaUrl: string | undefined;
      if (v.base64) mediaUrl = await uploadCoverImage(userId, v.base64, Date.now());
      else if (v.videoUri) mediaUrl = await uploadCoverVideo(userId, v.videoUri, Date.now());
      await updateCover(editId, { cover_message: v.message.trim() ? v.message.trim() : null, ...(mediaUrl ? { cover_image_url: mediaUrl } : {}) });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['monthly-posts'] }); setEditId(null); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function onRecord() {
    if (myPosts.length === 0) {
      Alert.alert('담당인 달이 없어요', '관리자가 나를 그 달 담당자로 지정하면 표지를 작성할 수 있어요.');
      return;
    }
    setEditId(myPosts[0].id); // 가장 최근 담당 월
  }

  return (
    <Screen scroll>
      <BrandHeader />
      <Text variant="h1">기록</Text>
      <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
        매월 담당자가 표지와 글을 남깁니다. 눌러서 코멘트를 달아보세요.
      </Text>
      <Button label="기록하기" onPress={onRecord} style={styles.recordBtn} />

      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color={colors.light.textSecondary}>
            {userId ? '아직 표지가 없어요. 담당자가 표지를 올리면 여기 쌓여요.' : '로그인하면 표지가 보여요.'}
          </Text>
        </View>
      ) : (
        posts.map((p) => <CoverCard key={p.id} post={p} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })} />)
      )}

      <CoverEditModal
        visible={editId != null}
        initialMessage={editing?.cover_message ?? null}
        initialImage={editing?.cover_image_url ?? null}
        saving={coverMut.isPending}
        onClose={() => setEditId(null)}
        onSubmit={(v) => coverMut.mutate(v)}
      />
    </Screen>
  );
}

function CoverCard({ post, onPress }: { post: MonthlyPost; onPress: () => void }) {
  const isVideo = post.cover_image_url != null && /\.(mp4|mov|m4v)(\?|$)/i.test(post.cover_image_url);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {isVideo ? (
        <View style={[styles.cover, styles.coverEmpty]}>
          <Text variant="h2" color={colors.light.textSecondary}>🎬 동영상</Text>
        </View>
      ) : post.cover_image_url ? (
        <Image source={{ uri: post.cover_image_url }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverEmpty]}>
          <Text variant="mono" color={colors.light.textSecondary}>{post.year}.{String(post.month).padStart(2, '0')}</Text>
        </View>
      )}
      <View style={styles.body}>
        <Text variant="kicker" color={colors.light.textSecondary}>{post.year}년 {post.month}월</Text>
        <Text variant="bodyBold" style={{ fontSize: 17, marginTop: 4 }} numberOfLines={2}>
          {post.cover_message?.trim() || '표지 글이 아직 없어요'}
        </Text>
        <View style={styles.hostRow}>
          <View style={[styles.dot, { backgroundColor: post.color ?? colors.light.cobalt }]} />
          <Text variant="caption" color={colors.light.textSecondary}>담당 · {post.nickname}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  recordBtn: { marginTop: space.lg, marginBottom: space.lg, height: 48 },
  empty: { paddingVertical: space.section, alignItems: 'center' },
  card: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.light.hairline, overflow: 'hidden', marginBottom: space.lg, backgroundColor: colors.light.paper },
  cover: { width: '100%', height: 180, backgroundColor: colors.light.surfacePlate },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
