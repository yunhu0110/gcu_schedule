/**
 * GameEditModal — 운영자가 게임을 등록/수정하는 가운데 팝업.
 * 입력 순서: 썸네일(사진) → 링크 → 게임명 → 게임설명 → 장르. 썸네일은 base64로 골라 상위에서 업로드.
 */
import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme/tokens';

export type GameSubmit = { title: string; url: string; description: string; genre: string; base64: string | null; keepThumbnail: string | null };

type Props = {
  visible: boolean;
  initial?: { title: string; url: string; description: string | null; genre: string | null; thumbnail_url: string | null } | null;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (v: GameSubmit) => void;
};

export function GameEditModal({ visible, initial, saving, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [base64, setBase64] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setUrl(initial?.url ?? '');
      setDescription(initial?.description ?? '');
      setGenre(initial?.genre ?? '');
      setBase64(null);
      setPreview(initial?.thumbnail_url ?? null);
    }
  }, [visible, initial]);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 접근을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a?.base64) {
      setBase64(a.base64);
      setPreview(a.uri);
    }
  }

  function submit() {
    if (!title.trim()) { Alert.alert('게임명을 입력해주세요'); return; }
    if (!url.trim()) { Alert.alert('링크를 입력해주세요'); return; }
    onSubmit({ title, url, description, genre, base64, keepThumbnail: base64 ? null : initial?.thumbnail_url ?? null });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.center} behavior="padding">
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text variant="h2">{initial ? '게임 수정' : '게임 등록'}</Text>

            {/* 1. 썸네일 */}
            <Pressable onPress={pickImage} style={styles.imgBox}>
              {preview ? (
                <Image source={{ uri: preview }} style={styles.img} />
              ) : (
                <Text variant="body" color={colors.light.textSecondary}>＋ 썸네일 사진 (갤러리)</Text>
              )}
            </Pressable>
            {preview ? <Button label="사진 변경" variant="ghost" block onPress={pickImage} /> : null}

            <View style={{ gap: space.md, marginTop: space.lg }}>
              {/* 2. 링크 */}
              <TextField label="링크 (URL)" value={url} onChangeText={setUrl} placeholder="https://..." autoCapitalize="none" keyboardType="url" />
              {/* 3. 게임명 */}
              <TextField label="게임명" value={title} onChangeText={setTitle} placeholder="게임 이름" />
              {/* 4. 게임설명 */}
              <TextField label="게임설명" value={description} onChangeText={setDescription} placeholder="한 줄 설명" multiline style={styles.textArea} />
              {/* 5. 장르 */}
              <TextField label="장르" value={genre} onChangeText={setGenre} placeholder="예: 파티 / 전략 / 추리" />
            </View>

            <Button label={saving ? '저장 중…' : '저장'} block loading={saving} onPress={submit} style={{ marginTop: space.lg }} />
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
  imgBox: { height: 160, borderRadius: radius.card, backgroundColor: colors.light.surfacePlate, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: space.lg },
  img: { width: '100%', height: '100%' },
  textArea: { height: 80, paddingTop: space.md, textAlignVertical: 'top' },
});
