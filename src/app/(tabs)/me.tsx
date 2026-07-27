/**
 * S8. 나 — 프로필/설정. 인증 연결(M0-4) 전까지는 자리 + 로그인 화면 이동 링크.
 */
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, space } from '@/theme/tokens';
import { useRouter } from 'expo-router';

export default function MeScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <Text variant="h1">나</Text>
      <SectionHeader label="프로필" />
      <Card>
        <Text variant="body" color={colors.light.textSecondary}>
          닉네임·프로필 사진·알림 설정이 여기에 들어갑니다. (인증은 M0-4)
        </Text>
        <Button
          label="로그인 화면 보기"
          variant="secondary"
          style={{ marginTop: space.md }}
          onPress={() => router.push('/sign-in')}
        />
      </Card>
    </Screen>
  );
}
