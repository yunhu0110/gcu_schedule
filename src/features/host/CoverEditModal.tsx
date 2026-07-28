/**
 * CoverEditModal — 그 달 담당자가 표지(사진 1장 + 글)를 올리거나 수정하는 팝업.
 * 사진은 base64로 골라 상위(post 화면)에서 업로드한다. 이 컴포넌트는 입력만.
 */
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme/tokens';
import { addDays, formatKo, todayStr, type DateStr } from '@/lib/date';

export type CoverSubmit = { message: string; base64: string | null; videoUri: string | null; date: DateStr };

type Props = {
  visible: boolean;
  initialMessage: string | null;
  initialImage: string | null;
  initialDate?: DateStr | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (v: CoverSubmit) => void;
};

export function CoverEditModal({ visible, initialMessage, initialImage, initialDate, saving, onClose, onSubmit }: Props) {
  const [message, setMessage] = useState('');
  const [base64, setBase64] = useState<string | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [date, setDate] = useState<DateStr>(todayStr());

  useEffect(() => {
    if (visible) {
      setMessage(initialMessage ?? '');
      setBase64(null);
      setVideoUri(null);
      setPreview(initialImage ?? null);
      setDate(initialDate ?? todayStr());
    }
  }, [visible, initialMessage, initialImage, initialDate]);

  const isVideoPreview = (preview ?? '').match(/\.(mp4|mov|m4v)$/i) != null || videoUri != null;

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진/동영상 접근을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.6, base64: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!a) return;
    if (a.type === 'video') {
      setVideoUri(a.uri);
      setBase64(null);
      setPreview(a.uri);
    } else if (a.base64) {
      setBase64(a.base64);
      setVideoUri(null);
      setPreview(a.uri);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior="padding">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">기록 작성</Text>

        {/* 날짜 */}
        <View style={styles.dateRow}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>날짜</Text>
          <View style={styles.stepper}>
            <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={10} style={styles.stepBtn}><Text variant="h2">‹</Text></Pressable>
            <Text variant="bodyBold" style={{ fontSize: 14 }}>{formatKo(date)}</Text>
            <Pressable onPress={() => setDate(addDays(date, 1))} hitSlop={10} style={styles.stepBtn}><Text variant="h2">›</Text></Pressable>
          </View>
        </View>

        <Pressable onPress={pickImage} style={styles.imgBox}>
          {preview && !isVideoPreview ? (
            <Image source={{ uri: preview }} style={styles.img} />
          ) : isVideoPreview ? (
            <Text variant="body" color={colors.light.textSecondary}>🎬 동영상 선택됨</Text>
          ) : (
            <Text variant="body" color={colors.light.textSecondary}>＋ 사진/동영상 (갤러리)</Text>
          )}
        </Pressable>
        {preview ? (
          <Button label="사진/동영상 변경" variant="ghost" block onPress={pickImage} />
        ) : null}

        <TextField
          label="내용"
          value={message}
          onChangeText={setMessage}
          multiline
          style={styles.textArea}
        />

        <Button
          label={saving ? '저장 중…' : '저장'}
          block
          loading={saving}
          onPress={() => onSubmit({ message, base64, videoUri, date })}
          style={{ marginTop: space.md }}
        />
        <Button label="취소" variant="ghost" block onPress={onClose} />
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: {
    backgroundColor: colors.light.paper,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: space.screen,
    paddingBottom: space.section,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  imgBox: {
    height: 160,
    borderRadius: radius.card,
    backgroundColor: colors.light.surfacePlate,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: space.lg,
  },
  img: { width: '100%', height: '100%' },
  textArea: { height: 96, paddingTop: space.md, textAlignVertical: 'top', marginTop: space.md },
});
