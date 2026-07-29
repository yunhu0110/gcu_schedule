/**
 * ConfirmDateModal — 담당자/관리자가 모임 날짜를 직접 확정(픽스)하는 팝업. 날짜 스텝퍼.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space } from '@/theme/tokens';
import { addDays, formatKo, startOfMonth, type DateStr } from '@/lib/date';

type Props = {
  visible: boolean;
  year: number;
  month: number;
  confirmed?: DateStr | null; // 이미 확정된 날짜(있으면 스텝퍼 시작값 + 초기화 버튼)
  saving?: boolean;
  clearing?: boolean;
  onClose: () => void;
  onSubmit: (date: DateStr) => void;
  onClear?: () => void;
};

export function ConfirmDateModal({ visible, year, month, confirmed, saving, clearing, onClose, onSubmit, onClear }: Props) {
  const first = startOfMonth(`${year}-${String(month).padStart(2, '0')}-01`);
  const start = confirmed ?? first;
  const [date, setDate] = useState(start);
  useEffect(() => { if (visible) setDate(start); }, [visible, start]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">{month}월 모임 날짜 확정</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          확정하면 홈·달력에 날짜가 표시되고 D-day가 계산돼요.
        </Text>
        <View style={styles.stepper}>
          <Pressable onPress={() => setDate(addDays(date, -1))} hitSlop={10} style={styles.stepBtn}><Text variant="h2">‹</Text></Pressable>
          <Text variant="bodyBold" style={{ fontSize: 16 }}>{formatKo(date)}</Text>
          <Pressable onPress={() => setDate(addDays(date, 1))} hitSlop={10} style={styles.stepBtn}><Text variant="h2">›</Text></Pressable>
        </View>
        <Button label={saving ? '확정 중…' : '이 날로 확정'} block loading={saving} onPress={() => onSubmit(date)} style={{ marginTop: space.lg }} />
        {/* 이 달만 미정으로 되돌리기 — 확정된 날짜가 있을 때만 */}
        {confirmed && onClear ? (
          <Pressable style={styles.clearBtn} onPress={onClear} disabled={clearing}>
            <Text variant="bodyBold" style={{ fontSize: 15 }} color={colors.light.danger}>
              {clearing ? '초기화 중…' : `${month}월 모임 날짜 초기화`}
            </Text>
          </Pressable>
        ) : null}
        <Button label="취소" variant="ghost" block onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: { backgroundColor: colors.light.paper, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, padding: space.screen, paddingBottom: space.section },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.light.hairlineStrong, borderRadius: radius.button, paddingHorizontal: space.md, height: 52, marginTop: space.lg },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  clearBtn: { height: 44, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
});
