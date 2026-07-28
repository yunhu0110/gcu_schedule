/**
 * ActionModal — 앱 디자인(폰트/토큰)을 입힌 확인·액션 팝업. 네이티브 Alert 대체.
 * 가운데 카드 + 제목/설명 + 세로 액션 버튼(기본/삭제/취소).
 */
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, space } from '@/theme/tokens';

export type Action = { label: string; onPress?: () => void; destructive?: boolean; cancel?: boolean };

type Props = {
  visible: boolean;
  title?: string;
  message?: string;
  actions: Action[];
  onClose: () => void;
};

export function ActionModal({ visible, title, message, actions, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.center}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.card}>
          {title ? <Text variant="h2" style={styles.title}>{title}</Text> : null}
          {message ? (
            <Text variant="bodySm" color={colors.light.textSecondary} style={styles.message}>{message}</Text>
          ) : null}
          <View style={styles.actions}>
            {actions.map((a, i) => (
              <Pressable
                key={a.label}
                style={[styles.btn, i > 0 && styles.btnBorder]}
                onPress={() => { onClose(); a.onPress?.(); }}
              >
                <Text
                  variant="bodyBold"
                  style={{ fontSize: 16 }}
                  color={a.destructive ? colors.light.danger : a.cancel ? colors.light.textSecondary : colors.light.action}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.ink60 },
  card: {
    width: '78%',
    maxWidth: 340,
    backgroundColor: colors.light.paper,
    borderRadius: radius.hero,
    paddingTop: space.xl,
    overflow: 'hidden',
  },
  title: { textAlign: 'center', paddingHorizontal: space.lg },
  message: { textAlign: 'center', marginTop: space.sm, paddingHorizontal: space.lg },
  actions: { marginTop: space.xl },
  btn: { height: 54, alignItems: 'center', justifyContent: 'center' },
  btnBorder: { borderTopWidth: 1, borderTopColor: colors.light.hairline },
});
