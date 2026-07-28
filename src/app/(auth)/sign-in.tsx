/**
 * 로그인 — 이메일+비밀번호(supabase.auth). 아이디 저장 + 비밀번호 찾기 지원.
 * 성공 시 세션 게이팅이 홈으로 보낸다. 백엔드 전에는 "둘러보기"로 미리 볼 수 있다(임시).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { Logo } from '@/components/Logo';
import { colors, space } from '@/theme/tokens';
import { deployDateLabel } from '@/lib/date';
import { signIn } from '@/api/auth';

const SAVED_EMAIL_KEY = 'saved_email';

export default function SignInScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 저장된 아이디 불러오기
  useEffect(() => {
    SecureStore.getItemAsync(SAVED_EMAIL_KEY).then((saved) => {
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    });
  }, []);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const { error: err } = await signIn(email, password);
    setLoading(false);
    if (err) {
      setError('로그인하지 못했어요. 이메일과 비밀번호를 확인해주세요.');
      return;
    }
    if (remember) await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.trim().toLowerCase());
    else await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
    // 성공 시 onAuthStateChange → 게이팅이 홈으로 이동
  }

  async function toggleRemember() {
    const next = !remember;
    setRemember(next);
    if (!next) await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
  }

  function onForgot() {
    router.push('/reset-password');
  }

  return (
    <Screen scroll padded>
      <View style={styles.top}>
        <Text variant="kicker" color={colors.light.textSecondary}>
          배포일 {deployDateLabel()}
        </Text>
      </View>

      <View style={styles.head}>
        <View style={styles.wordmarkRow}>
          <Logo height={44} />
          <Text style={styles.wordmark}>월간GCU</Text>
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
        <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />

        <View style={styles.rowBetween}>
          <Pressable style={styles.check} onPress={toggleRemember} hitSlop={8}>
            <View style={[styles.box, remember && styles.boxOn]}>{remember ? <Text variant="caption" color={colors.light.paper}>✓</Text> : null}</View>
            <Text variant="bodySm" color={colors.light.textSecondary}>아이디 저장</Text>
          </Pressable>
          <Pressable onPress={onForgot} hitSlop={8}>
            <Text variant="bodySm" color={colors.light.action}>비밀번호 찾기</Text>
          </Pressable>
        </View>

        {error ? <Text variant="bodySm" color={colors.light.neon}>{error}</Text> : null}
        <Button label="로그인" block loading={loading} onPress={onSubmit} style={{ marginTop: space.xs }} />
        <Button label="가입하기" variant="ghost" block onPress={() => router.push('/join')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingTop: space.lg },
  head: { marginTop: space.section },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wordmark: { fontFamily: 'Jalnan2', fontSize: 48, lineHeight: 58, color: colors.light.ink, letterSpacing: -1 },
  form: { gap: space.md, marginTop: space.section },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.light.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.light.cobalt, borderColor: colors.light.cobalt },
  footer: { marginTop: space.section },
});
