/**
 * BrandHeader — 모든 페이지 상단 공통 헤더. 로고 + 월간GCU + 알림벨(미읽음 배지) → 알림 페이지.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Logo } from './Logo';
import { Text } from './Text';
import { TabIcon } from './TabIcon';
import { colors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { unreadCount } from '@/api/notifications';

export function BrandHeader() {
  const router = useRouter();
  const { userId } = useAuth();

  const { data: unread = 0 } = useQuery({
    queryKey: ['unread', userId],
    queryFn: () => unreadCount(userId as string),
    enabled: !!userId,
    refetchInterval: 30000,
  });

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <Logo height={22} />
        <Text variant="brand">월간GCU</Text>
      </View>
      <Pressable onPress={() => router.push('/notifications')} hitSlop={10}>
        <TabIcon name="bell" color={colors.light.ink} size={24} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text variant="caption" color={colors.light.paper} style={styles.badgeText}>
              {unread > 9 ? '9+' : unread}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.lg },
  left: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: {
    position: 'absolute',
    right: -6,
    top: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.light.neon,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, lineHeight: 14 },
});
