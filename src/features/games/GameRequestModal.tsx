/**
 * GameRequestModal — 일반 멤버가 게임 추가를 운영자에게 요청하는 가운데 팝업.
 * 입력: 게임명 · 관련 URL · 커스텀 요청 내용. 제출하면 운영자에게 인앱 알림으로 전달된다.
 */
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme/tokens';

export type GameRequest = { title: string; url: string; note: string };

type Props = {
  visible: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (v: GameRequest) => void;
};

export function GameRequestModal({ visible, saving, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (visible) { setTitle(''); setUrl(''); setNote(''); }
  }, [visible]);

  function submit() {
    if (!title.trim() && !note.trim()) { Alert.alert('내용을 입력해주세요', '게임명이나 요청 내용을 적어주세요.'); return; }
    onSubmit({ title, url, note });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.center} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text variant="h2">게임 요청하기</Text>
            <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
              추가했으면 하는 게임을 운영자에게 알림으로 전달해요.
            </Text>

            <View style={{ gap: space.md, marginTop: space.lg }}>
              <TextField label="게임명" value={title} onChangeText={setTitle} placeholder="어떤 게임인가요?" />
              <TextField label="관련 URL" value={url} onChangeText={setUrl} placeholder="https://... (선택)" autoCapitalize="none" keyboardType="url" />
              <TextField label="요청 내용" value={note} onChangeText={setNote} placeholder="운영자에게 남길 요청 내용" multiline style={styles.textArea} />
            </View>

            <Button label={saving ? '보내는 중…' : '요청 보내기'} block loading={saving} onPress={submit} style={{ marginTop: space.lg }} />
            <Button label="취소" variant="ghost" block onPress={onClose} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', backgroundColor: colors.light.ink60 },
  card: { backgroundColor: colors.light.paper, borderRadius: radius.hero, marginHorizontal: space.screen, padding: space.screen, maxHeight: '86%' },
  textArea: { height: 96, paddingTop: space.md, textAlignVertical: 'top' },
});
