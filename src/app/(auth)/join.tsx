/**
 * 초대 코드 가입 — 코드+이메일+비번+닉네임 → join Edge Function → 자동 로그인.
 * 정원 6명/사용된 코드/만료는 서버(Edge)가 판정하고 사유를 그대로 보여준다.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';
import { joinWithCode } from '@/api/auth';

export default function JoinScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    const res = await joinWithCode({ code: code.trim(), nickname: nickname.trim(), email, password });
    setLoading(false);
    if (!res.ok) setError(res.error ?? '가입에 실패했어요.');
    // 성공 시 자동 로그인 → 세션 게이팅이 홈으로 이동
  }

  return (
    <Screen scroll padded>
      <View style={styles.head}>
        <Text variant="kicker" color={colors.light.cobalt}>
          INVITE ONLY · 6
        </Text>
        <Text variant="h1" style={{ marginTop: space.sm }}>
          초대 코드로 시작
        </Text>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.sm }}>
          관리자가 준 1회용 코드로 가입해요. 정원은 6명.
        </Text>
      </View>

      <View style={styles.form}>
        <TextField label="초대 코드" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="GCU-A1" />
        <TextField label="닉네임" value={nickname} onChangeText={setNickname} placeholder="표시 이름" />
        <TextField
          label="이메일"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry placeholder="6자 이상" />
        {error ? (
          <Text variant="bodySm" color={colors.light.neon}>
            {error}
          </Text>
        ) : null}
        <Button label="가입하기" block loading={loading} onPress={onSubmit} style={{ marginTop: space.xs }} />
        <Button label="뒤로" variant="ghost" block onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { marginTop: space.xl },
  form: { gap: space.md, marginTop: space.section },
});
