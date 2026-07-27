/**
 * 회원가입 — 닉네임+이메일+비번(초대코드 없음, ADR-009) → auth.signUp → members 생성 → 자동 로그인.
 * 정원 6명 초과/중복 이메일은 서버가 판정하고 사유를 그대로 보여준다.
 * 프로필사진은 가입 후 '나' 탭에서 설정(후속 기능).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';
import { signUpMember } from '@/api/auth';

export default function JoinScreen() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!nickname.trim() || !email.trim() || password.length < 6) {
      setError('닉네임, 이메일, 6자 이상 비밀번호를 모두 입력해주세요.');
      return;
    }
    setLoading(true);
    const res = await signUpMember({ nickname, email, password });
    setLoading(false);
    if (!res.ok) setError(res.error ?? '가입에 실패했어요.');
    // 성공 시 세션 생성 → 게이팅이 홈으로 이동
  }

  return (
    <Screen scroll padded>
      <View style={styles.head}>
        <Text variant="kicker" color={colors.light.cobalt}>
          월간gcu · 6
        </Text>
        <Text variant="h1" style={{ marginTop: space.sm }}>
          가입하기
        </Text>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.sm }}>
          닉네임과 이메일로 바로 시작해요. 정원은 6명.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField label="닉네임" value={nickname} onChangeText={setNickname} placeholder="표시 이름" />
        <TextField
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry placeholder="6자 이상" />
        {error ? (
          <Text variant="bodySm" color={colors.light.neon}>
            {error}
          </Text>
        ) : null}
        <Button label="가입하기" block loading={loading} onPress={onSubmit} style={{ marginTop: space.xs }} />
        <Button label="이미 계정이 있어요" variant="ghost" block onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: space.xl },
  form: { gap: space.md, marginTop: space.section },
});
