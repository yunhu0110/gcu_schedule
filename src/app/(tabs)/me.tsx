/**
 * S8. 나 — 프로필(닉네임/프사) + 로그아웃. 상시불가요일·알림·통계는 이후 마일스톤.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile } from '@/api/members';
import { signOut } from '@/api/auth';
import { useDevStore } from '@/store/devStore';

export default function MeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const setPreview = useDevStore((s) => s.setPreview);
  const preview = useDevStore((s) => s.previewMode);

  const { data: me } = useQuery({
    queryKey: ['me', userId],
    queryFn: () => getMyProfile(userId as string),
    enabled: !!userId,
  });

  async function onLogout() {
    setPreview(false);
    await signOut();
    router.replace('/sign-in');
  }

  return (
    <Screen scroll>
      <Text variant="h1">마이페이지</Text>

      <SectionHeader label="프로필" />
      <Card>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text variant="h2" color={colors.light.textSecondary}>
              {(me?.nickname ?? '?').slice(0, 1)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{me?.nickname ?? (preview ? '둘러보기 (미로그인)' : '불러오는 중…')}</Text>
            <Text variant="caption" color={colors.light.textSecondary}>
              {me?.is_admin ? '관리자' : '멤버'}
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader label="계정" />
      <Card>
        <Text variant="bodySm" color={colors.light.textSecondary}>
          상시 불가 요일·알림 설정·내 통계는 이후 마일스톤에서 추가돼요.
        </Text>
        <Button label={preview ? '로그인 화면으로' : '로그아웃'} variant="secondary" block style={{ marginTop: space.md }} onPress={onLogout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.light.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
