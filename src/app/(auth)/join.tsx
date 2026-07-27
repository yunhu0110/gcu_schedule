/**
 * 초대 코드 가입 — 코드 검증 → 이메일/비번 → 닉네임/프로필사진. 실제 흐름은 M0-4.
 */
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme/tokens';
import { useRouter } from 'expo-router';

export default function JoinScreen() {
  const router = useRouter();
  return (
    <Screen padded>
      <View style={styles.center}>
        <Text variant="kicker" color={colors.light.cobalt}>
          INVITE ONLY · 6
        </Text>
        <Text variant="h1" style={{ marginTop: space.sm }}>
          초대 코드로 시작
        </Text>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.md }}>
          관리자가 준 1회용 초대 코드를 입력하면 가입할 수 있어요.{'\n'}정원은 6명입니다.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="다음" block onPress={() => router.replace('/')} />
        <Button label="뒤로" variant="ghost" block onPress={() => router.back()} />
        <Text variant="caption" color={colors.light.textSecondary} style={styles.note}>
          코드 입력 폼과 검증(Edge Function)은 M0-4에서 연결됩니다.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  actions: { gap: space.sm, paddingBottom: space.xl },
  note: { textAlign: 'center', marginTop: space.xs },
});
