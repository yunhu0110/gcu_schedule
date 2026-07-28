/**
 * 버그·문의 — 관리자(yunhu0110@gmail.com)에게 메일 전송. 기기 메일 앱을 mailto로 연다.
 * 별도 서버 없이 사용자의 메일 앱으로 수신자·제목·본문을 프리필한다.
 */
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';

const ADMIN_EMAIL = 'yunhu0110@gmail.com';

export default function FeedbackScreen() {
  const router = useRouter();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function send() {
    if (!subject.trim() && !body.trim()) {
      Alert.alert('내용을 입력해주세요', '제목이나 내용을 적어주세요.');
      return;
    }
    const url =
      `mailto:${ADMIN_EMAIL}` +
      `?subject=${encodeURIComponent(`[월간gcu] ${subject.trim() || '문의'}`)}` +
      `&body=${encodeURIComponent(body)}`;
    const ok = await Linking.canOpenURL(url);
    if (!ok) {
      Alert.alert('메일 앱을 열 수 없어요', `직접 ${ADMIN_EMAIL} 로 보내주세요.`);
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="h2">‹ 뒤로</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text variant="h1">버그·문의</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          관리자에게 메일로 전달돼요. ({ADMIN_EMAIL})
        </Text>

        <View style={{ gap: space.md, marginTop: space.xl }}>
          <TextField label="제목" value={subject} onChangeText={setSubject} placeholder="무엇에 대한 문의인가요?" />
          <TextField
            label="내용"
            value={body}
            onChangeText={setBody}
            placeholder="버그 상황이나 문의 내용을 적어주세요."
            multiline
            style={styles.textArea}
          />
          <Button label="메일 앱으로 보내기" block onPress={send} style={{ marginTop: space.sm }} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  topbar: { paddingHorizontal: space.screen, height: 48, justifyContent: 'center' },
  content: { paddingHorizontal: space.screen },
  textArea: { height: 140, paddingTop: space.md, textAlignVertical: 'top' },
});
