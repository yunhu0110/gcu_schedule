/**
 * 내 정보 수정 — 비밀번호 변경(로그인 상태). 이메일은 표시만.
 */
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { SectionHeader } from '@/components/SectionHeader';
import { Card } from '@/components/Card';
import { colors, space } from '@/theme/tokens';
import { updatePassword } from '@/api/auth';

export default function AccountScreen() {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function onChange() {
    if (pw.length < 6) {
      Alert.alert('비밀번호 확인', '6자 이상으로 입력해주세요.');
      return;
    }
    if (pw !== pw2) {
      Alert.alert('비밀번호 불일치', '두 비밀번호가 달라요.');
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(pw);
    setBusy(false);
    if (error) Alert.alert('변경 실패', error.message);
    else {
      Alert.alert('변경 완료', '비밀번호가 바뀌었어요.');
      setPw('');
      setPw2('');
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
          <Text variant="h1">내 정보 수정</Text>

          <SectionHeader label="비밀번호 변경" />
          <Card>
            <View style={{ gap: space.md }}>
              <TextField label="새 비밀번호 (6자 이상)" value={pw} onChangeText={setPw} secureTextEntry placeholder="••••••••" />
              <TextField label="새 비밀번호 확인" value={pw2} onChangeText={setPw2} secureTextEntry placeholder="••••••••" />
              <Button label={busy ? '변경 중…' : '비밀번호 변경'} block loading={busy} onPress={onChange} />
            </View>
          </Card>
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
