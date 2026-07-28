/**
 * ProfileEditModal — 프사를 누르면 뜨는 프로필 편집 팝업.
 * 사진 변경(갤러리, 즉시) · 고유색(20) · 닉네임. 저장/닫기는 하단 한 행.
 */
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, memberColors, radius, space } from '@/theme/tokens';

type Props = {
  visible: boolean;
  nickname: string;
  color: string | null;
  avatarUrl: string | null;
  busy?: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onSaveProfile: (nickname: string, color: string | null) => void;
};

export function ProfileEditModal({ visible, nickname, color, avatarUrl, busy, onClose, onPickPhoto, onSaveProfile }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(nickname);
  const [sel, setSel] = useState<string | null>(color);

  useEffect(() => {
    if (visible) {
      setName(nickname);
      setSel(color);
    }
  }, [visible, nickname, color]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.kav} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text variant="h2">프로필 편집</Text>

            <View style={styles.photoRow}>
              <Pressable onPress={onPickPhoto}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: sel ?? colors.light.mist }]}>
                    <Text variant="h2" color={colors.light.paper}>{(name || '?').slice(0, 1)}</Text>
                  </View>
                )}
              </Pressable>
              <Button label="사진 변경 (갤러리)" variant="secondary" onPress={onPickPhoto} style={styles.photoBtn} />
            </View>

            <TextField label="닉네임" value={name} onChangeText={setName} style={{ marginTop: space.lg }} />

            <Text variant="caption" color={colors.light.textSecondary} style={{ marginTop: space.lg, marginBottom: space.sm }}>
              고유색 (달력에서 나를 표시하는 색)
            </Text>
            <View style={styles.swatches}>
              {memberColors.map((c) => {
                const on = sel === c;
                return (
                  <Pressable key={c} onPress={() => setSel(c)} style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]}>
                    {on ? <Text variant="caption" color={colors.light.paper}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* 저장 / 닫기 한 행 (하단) */}
          <View style={styles.actions}>
            <Button label={busy ? '저장 중…' : '저장'} loading={busy} onPress={() => name.trim() && onSaveProfile(name, sel)} style={styles.actBtn} />
            <Button label="닫기" variant="secondary" onPress={onClose} style={styles.actBtn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: { backgroundColor: colors.light.paper, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, padding: space.screen, paddingBottom: space.section, maxHeight: '88%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  photoBtn: { height: 44, paddingHorizontal: space.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.light.ink },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  actBtn: { flex: 1, height: 48 },
});
