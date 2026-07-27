/**
 * 초대 코드 가입 — 코드 검증 → 이메일/비번 → 닉네임/프로필사진. 실제 흐름은 M0-4.
 */
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme/tokens';
import { useRouter } from 'expo-router';

export default function JoinScreen() {
  const router = useRouter();
  return (
    <Screen padded>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <Text variant="h1">초대 코드로 시작</Text>
        <Text variant="body" color={colors.light.textSecondary}>
          관리자가 준 1회용 초대 코드를 입력하면 가입할 수 있어요. 정원은 6명입니다. (입력 폼은 M0-4)
        </Text>
        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Button label="다음" onPress={() => router.replace('/')} />
          <Button label="뒤로" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    </Screen>
  );
}
