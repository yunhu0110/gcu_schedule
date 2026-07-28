/**
 * 알림 — 누가 일정 등록/수정, 투표 시작/참여, 날짜 확정, 아이디어 추가했는지 확인. 진입 시 읽음 처리.
 */
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { colors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { listNotifications, markAllRead } from '@/api/notifications';

export default function NotificationsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => listNotifications(userId as string),
    enabled: !!userId,
  });

  // 진입 시 전체 읽음 처리
  useEffect(() => {
    if (!userId) return;
    markAllRead(userId).then(() => {
      qc.invalidateQueries({ queryKey: ['unread'] });
    });
  }, [userId, qc]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="h2">‹ 뒤로</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text variant="h1">알림</Text>
        {items.length === 0 ? (
          <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.xl }}>
            아직 알림이 없어요.
          </Text>
        ) : (
          items.map((n) => (
            <View key={n.id} style={[styles.row, !n.read_at && styles.unread]}>
              <View style={[styles.dot, { backgroundColor: n.read_at ? colors.light.hairlineStrong : colors.light.neon }]} />
              <View style={{ flex: 1 }}>
                <Text variant="body">{n.body}</Text>
                <Text variant="caption" color={colors.light.textSecondary}>{n.created_at.slice(5, 16).replace('T', ' ')}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  topbar: { paddingHorizontal: space.screen, height: 48, justifyContent: 'center' },
  content: { paddingHorizontal: space.screen, paddingBottom: space.section },
  row: { flexDirection: 'row', gap: space.md, paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.light.hairline },
  unread: {},
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
