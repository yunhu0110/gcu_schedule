/**
 * S4. 기록 — 월별 표지 피드. 그 달 담당자가 사진 1장 + 글을 올리고, 최근 달부터 내림차순으로 쌓인다.
 * 표지를 누르면 상세(+댓글)로 이동. 표지는 hosts(cover_image_url/cover_message)를 그대로 쓴다.
 */
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { listMonthlyPosts, type MonthlyPost } from '@/api/hosts';

export default function RecordScreen() {
  const router = useRouter();
  const { userId } = useAuth();

  const { data: posts = [] } = useQuery({
    queryKey: ['monthly-posts'],
    queryFn: listMonthlyPosts,
    enabled: !!userId,
  });

  return (
    <Screen scroll>
      <Text variant="h1">기록</Text>
      <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs, marginBottom: space.lg }}>
        매달 담당자가 남기는 표지. 눌러서 코멘트를 달아보세요.
      </Text>

      {posts.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color={colors.light.textSecondary}>
            {userId ? '아직 표지가 없어요. 담당자가 정해지고 표지를 올리면 여기 쌓여요.' : '로그인하면 표지가 보여요.'}
          </Text>
        </View>
      ) : (
        posts.map((p) => <CoverCard key={p.id} post={p} onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })} />)
      )}
    </Screen>
  );
}

function CoverCard({ post, onPress }: { post: MonthlyPost; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {post.cover_image_url ? (
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
  empty: { paddingVertical: space.section, alignItems: 'center' },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.light.hairline,
    overflow: 'hidden',
    marginBottom: space.lg,
    backgroundColor: colors.light.paper,
  },
  cover: { width: '100%', height: 180, backgroundColor: colors.light.surfacePlate },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
