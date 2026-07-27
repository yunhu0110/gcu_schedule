/**
 * 로그인 — 이메일+비밀번호. 실제 인증(supabase.auth)은 M0-4에서 연결.
 * 지금은 화면 골격 + 가입 화면 이동.
 */
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { volLabel, todayStr } from '@/lib/date';

export default function SignInScreen() {
  const router = useRouter();
  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <Text variant="mono" color={colors.light.textSecondary}>
          VOL. {volLabel(todayStr())}
        </Text>
        <Text variant="display">월간gcu</Text>
        <Text variant="body" color={colors.light.textSecondary}>
          6명의 기록과 일정을 한곳에. 이메일로 로그인하세요. (입력 폼은 M0-4)
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label="로그인" onPress={() => router.replace('/')} />
          <Button label="초대 코드로 시작하기" variant="ghost" onPress={() => router.push('/join')} />
        </View>
      </View>
    </Screen>
  );
}
