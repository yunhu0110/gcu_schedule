/**
 * 로그인 — 이메일+비밀번호(supabase.auth). 성공 시 세션 게이팅이 홈으로 보낸다.
 * 백엔드 적용/관리자 부트스트랩 전에는 "둘러보기"로 탭 화면을 미리 볼 수 있다(임시).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { colors, space } from '@/theme/tokens';
import { todayStr, volLabel } from '@/lib/date';
import { signIn } from '@/api/auth';
import { useDevStore } from '@/store/devStore';

export default function SignInScreen() {
  const router = useRouter();
  const setPreview = useDevStore((s) => s.setPreview);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) setError('로그인하지 못했어요. 이메일과 비밀번호를 확인해주세요.');
    // 성공 시 onAuthStateChange → 게이팅이 홈으로 이동
  }

  return (
    <Screen scroll padded>
      <View style={styles.top}>
        <Logo height={28} />
        <Text variant="kicker" color={colors.light.textSecondary}>
          VOL. {volLabel(todayStr())}
        </Text>
      </View>

      <View style={styles.head}>
        <View style={styles.wordmarkRow}>
          <Logo height={44} />
          <Text style={styles.wordmark}>월간gcu</Text>
        </View>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.sm }}>
          월간GCU 스케줄 관리 앱
        </Text>
      </View>

      <View style={styles.form}>
        <TextField
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        {error ? (
          <Text variant="bodySm" color={colors.light.neon}>
            {error}
          </Text>
        ) : null}
        <Button label="로그인" block loading={loading} onPress={onSubmit} style={{ marginTop: space.xs }} />
        <Button
          label="가입하기"
          variant="ghost"
          block
          onPress={() => router.push('/join')}
        />
      </View>

      <View style={styles.footer}>
        <Button
          label="백엔드 없이 둘러보기 (임시)"
          variant="ghost"
          block
          onPress={() => {
            setPreview(true);
            router.replace('/calendar');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: space.lg },
  head: { marginTop: space.section },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wordmark: { fontFamily: 'Jalnan2', fontSize: 48, lineHeight: 58, color: colors.light.ink, letterSpacing: -1 },
  form: { gap: space.md, marginTop: space.section },
  footer: { marginTop: space.section },
});
