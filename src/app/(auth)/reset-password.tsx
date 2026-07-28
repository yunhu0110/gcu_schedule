/**
 * 비밀번호 재설정 — 관리자에게 인증코드를 문의받아 입력하면 새 비밀번호로 변경.
 * 인증코드 요청 시 관리자에게 알림으로 코드가 전달된다(메일 아님).
 */
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';
import { requestPasswordReset, resetPasswordWithCode } from '@/api/auth';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  async function onRequest() {
    if (!email.trim()) {
      Alert.alert('이메일을 입력해주세요');
      return;
    }
    setBusy(true);
    await requestPasswordReset(email);
    setBusy(false);
    Alert.alert('인증코드 요청됨', '관리자에게 인증코드를 문의하세요. 받은 코드를 아래에 입력하면 비밀번호를 바꿀 수 있어요.');
  }

  async function onReset() {
    if (!email.trim() || !code.trim() || pw.length < 6) {
      Alert.alert('입력 확인', '이메일·인증코드·새 비밀번호(6자 이상)를 모두 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const ok = await resetPasswordWithCode(email, code, pw);
      setBusy(false);
      if (ok) {
        Alert.alert('변경 완료', '새 비밀번호로 로그인해주세요.');
        router.back();
      } else {
        Alert.alert('실패', '인증코드가 올바르지 않거나 만료됐어요.');
      }
    } catch {
      setBusy(false);
      Alert.alert('오류', '잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="h2">‹ 뒤로</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <Text variant="h1">비밀번호 찾기</Text>
          <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
            인증코드를 요청하면 관리자에게 코드가 전달돼요. 관리자에게 문의해 코드를 받아 입력하세요.
          </Text>

          <View style={{ gap: space.md, marginTop: space.xl }}>
            <TextField label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" />
            <Button label={busy ? '요청 중…' : '인증코드 요청'} variant="secondary" block onPress={onRequest} />

            <TextField label="인증코드" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="관리자에게 받은 코드" />
            <TextField label="새 비밀번호 (6자 이상)" value={pw} onChangeText={setPw} secureTextEntry placeholder="••••••••" />
            <Button label={busy ? '변경 중…' : '비밀번호 변경'} block loading={busy} onPress={onReset} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  flex: { flex: 1 },
  topbar: { paddingHorizontal: space.screen, height: 48, justifyContent: 'center' },
  content: { paddingHorizontal: space.screen },
});
