/**
 * HostPickerModal — 관리자가 그 달 담당자(모임장)를 고르는 팝업. 멤버 목록에서 택1.
 */
import { Modal, Pressable, StyleSheet, View, Image } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space } from '@/theme/tokens';
import type { Member } from '@/api/members';

type Props = {
  visible: boolean;
  monthLabel: string; // 예: "8월"
  members: Member[];
  currentId?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSelect: (memberId: string) => void;
};

export function HostPickerModal({ visible, monthLabel, members, currentId, saving, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">{monthLabel} 담당자 지정</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          이 달의 모임을 이끌 담당자를 골라요.
        </Text>

        <View style={{ marginTop: space.lg }}>
          {members.map((m) => {
            const on = m.id === currentId;
            return (
              <Pressable
                key={m.id}
                onPress={() => !saving && onSelect(m.id)}
                style={[styles.row, on && styles.rowOn]}
              >
                {m.avatar_url ? (
                  <Image source={{ uri: m.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: m.color ?? colors.light.mist }]}>
                    <Text variant="caption" color={colors.light.paper}>{m.nickname.slice(0, 1)}</Text>
                  </View>
                )}
                <Text variant="bodyBold" style={{ flex: 1, fontSize: 15 }}>{m.nickname}</Text>
                {on ? <Text variant="bodyBold" color={colors.light.cobalt}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Button label="닫기" variant="ghost" block onPress={onClose} style={{ marginTop: space.md }} />
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
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.light.hairline,
    marginBottom: space.sm,
  },
  rowOn: { borderColor: colors.light.cobalt, backgroundColor: colors.light.cobalt12 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
