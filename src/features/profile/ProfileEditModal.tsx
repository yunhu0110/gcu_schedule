/**
 * ProfileEditModal — 마이페이지에서 프사를 누르면 뜨는 프로필 편집 팝업.
 * 사진 변경(갤러리) · 고유색 변경(20색) · 닉네임 변경을 한 곳에서. 실제 저장은 상위(me)가 담당.
 */
import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  onSaveNickname: (name: string) => void;
  onPickColor: (color: string) => void;
};

export function ProfileEditModal({ visible, nickname, color, avatarUrl, busy, onClose, onPickPhoto, onSaveNickname, onPickColor }: Props) {
  const [name, setName] = useState(nickname);
  useEffect(() => {
    if (visible) setName(nickname);
  }, [visible, nickname]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text variant="h2">프로필 편집</Text>

          {/* 사진 */}
          <View style={styles.photoRow}>
            <Pressable onPress={onPickPhoto}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: color ?? colors.light.mist }]}>
                  <Text variant="h2" color={colors.light.paper}>{(nickname || '?').slice(0, 1)}</Text>
                </View>
              )}
            </Pressable>
            <Button label="사진 변경 (갤러리)" variant="secondary" onPress={onPickPhoto} style={styles.photoBtn} />
          </View>

          {/* 닉네임 */}
          <View style={styles.nickRow}>
            <TextField label="닉네임" value={name} onChangeText={setName} style={{ flex: 1 }} />
            <Button label="저장" onPress={() => name.trim() && onSaveNickname(name)} loading={busy} style={styles.nickBtn} />
          </View>

          {/* 고유색 20 */}
          <Text variant="caption" color={colors.light.textSecondary} style={{ marginTop: space.lg, marginBottom: space.sm }}>
            고유색 (달력에서 나를 표시하는 색)
          </Text>
          <View style={styles.swatches}>
            {memberColors.map((c) => {
              const on = color === c;
              return (
                <Pressable key={c} onPress={() => onPickColor(c)} style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]}>
                  {on ? <Text variant="caption" color={colors.light.paper}>✓</Text> : null}
                </Pressable>
              );
            })}
          </View>

          <Button label="닫기" variant="ghost" block onPress={onClose} style={{ marginTop: space.lg }} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: {
    backgroundColor: colors.light.paper,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: space.screen,
    paddingBottom: space.section,
    maxHeight: '86%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  photoBtn: { height: 44, paddingHorizontal: space.lg },
  nickRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  nickBtn: { height: 48, paddingHorizontal: space.lg },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.light.ink },
});
