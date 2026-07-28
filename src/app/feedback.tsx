/**
 * 문의 — 버그/문의를 관리자에게 인앱 알림으로 전달한다(메일 아님).
 * 관리자는 알림 페이지에서 확인한다.
 */
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { notifyMembers } from '@/api/notifications';

export default function FeedbackScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('로그인이 필요해요.');
      const admins = members.filter((m) => m.is_admin).map((m) => m.id);
      if (admins.length === 0) throw new Error('관리자를 찾을 수 없어요.');
      const nick = me?.nickname ?? '멤버';
      const text = `[문의] ${subject.trim() || '(제목 없음)'} — ${body.trim()} (from ${nick})`;
      await notifyMembers(userId, admins, 'feedback', text, true);
    },
    onSuccess: () => {
      Alert.alert('전달 완료', '관리자에게 문의가 전달됐어요.');
      router.back();
    },
    onError: (e) => Alert.alert('전송 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function send() {
    if (!subject.trim() && !body.trim()) {
      Alert.alert('내용을 입력해주세요', '제목이나 내용을 적어주세요.');
      return;
    }
    sendMut.mutate();
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.topbar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text variant="h2">‹ 뒤로</Text>
        </Pressable>
      </View>
      <KeyboardAwareScrollView contentContainerStyle={styles.content} enableOnAndroid extraScrollHeight={24} keyboardShouldPersistTaps="handled">
          <Text variant="h1">문의</Text>
          <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
            버그·문의를 관리자에게 알림으로 전달해요.
          </Text>

          <View style={{ gap: space.md, marginTop: space.xl }}>
            <TextField label="제목" value={subject} onChangeText={setSubject} placeholder="무엇에 대한 문의인가요?" />
            <TextField label="내용" value={body} onChangeText={setBody} placeholder="버그 상황이나 문의 내용을 적어주세요." multiline style={styles.textArea} />
            <Button label={sendMut.isPending ? '보내는 중…' : '문의 보내기'} block loading={sendMut.isPending} onPress={send} style={{ marginTop: space.sm }} />
          </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  flex: { flex: 1 },
  topbar: { paddingHorizontal: space.screen, height: 48, justifyContent: 'center' },
  content: { paddingHorizontal: space.screen },
  textArea: { height: 140, paddingTop: space.md, textAlignVertical: 'top' },
});
