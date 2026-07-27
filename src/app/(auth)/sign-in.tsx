/**
 * 로그인 — 이메일+비밀번호. 실제 인증(supabase.auth)은 M0-4에서 연결.
 * 지금은 하이에너지 브랜드 화면 골격 + 가입 화면 이동.
 */
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, space } from '@/theme/tokens';
import { useRouter } from 'expo-router';
import { todayStr, volLabel } from '@/lib/date';

const LOGO_COLORS = ['#004E96', '#80C341', '#00B9F2', '#FCAF16'];

export default function SignInScreen() {
  const router = useRouter();
  return (
    <Screen padded>
      <View style={styles.top}>
        <View style={styles.mark}>
          {LOGO_COLORS.map((c) => (
            <View key={c} style={[styles.markBar, { backgroundColor: c }]} />
          ))}
        </View>
        <Text variant="kicker" color={colors.light.textSecondary}>
          VOL. {volLabel(todayStr())}
        </Text>
      </View>

      <View style={styles.center}>
        <Text style={styles.wordmark}>월간gcu</Text>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.md }}>
          6명의 기록과 일정을 한곳에.{'\n'}이메일로 로그인하세요.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button label="로그인" block onPress={() => router.replace('/')} />
        <Button
          label="초대 코드로 시작하기"
          variant="ghost"
          block
          onPress={() => router.push('/join')}
        />
        <Text variant="caption" color={colors.light.textSecondary} style={styles.note}>
          입력 폼과 실제 인증은 M0-4에서 연결됩니다.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg },
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 24 },
  markBar: { width: 6, height: 20, borderRadius: 3 },
  center: { flex: 1, justifyContent: 'center' },
  wordmark: { fontFamily: 'Jalnan2', fontSize: 52, color: colors.light.ink, letterSpacing: -1 },
  actions: { gap: space.sm, paddingBottom: space.xl },
  note: { textAlign: 'center', marginTop: space.xs },
});
