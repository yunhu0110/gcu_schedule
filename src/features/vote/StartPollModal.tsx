/**
 * StartPollModal — 담당자가 후보 날짜들을 골라 날짜 투표를 시작하는 팝업. 투표 기한도 설정.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space } from '@/theme/tokens';
import { addDays, diffDays, formatKo, startOfMonth, type DateStr } from '@/lib/date';

type Props = {
  visible: boolean;
  year: number;
  month: number;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (dates: DateStr[], deadline: DateStr) => void;
};

export function StartPollModal({ visible, year, month, saving, onClose, onSubmit }: Props) {
  const first = startOfMonth(`${year}-${String(month).padStart(2, '0')}-01`);
  const [cursor, setCursor] = useState(first);
  const [dates, setDates] = useState<DateStr[]>([]);
  const [deadline, setDeadline] = useState(first);

  useEffect(() => {
    if (visible) {
      setCursor(first);
      setDates([]);
      setDeadline(addDays(first, 20));
    }
  }, [visible, first]);

  function addDate() {
    if (!dates.includes(cursor)) setDates([...dates, cursor].sort());
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">{month}월 날짜 투표 시작</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          후보 날짜를 고르면 멤버들이 가능한 날에 투표해요.
        </Text>

        {/* 후보 날짜 추가 */}
        <View style={styles.stepper}>
          <Pressable onPress={() => setCursor(addDays(cursor, -1))} hitSlop={10} style={styles.stepBtn}>
            <Text variant="h2">‹</Text>
          </Pressable>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>{formatKo(cursor)}</Text>
          <Pressable onPress={() => setCursor(addDays(cursor, 1))} hitSlop={10} style={styles.stepBtn}>
            <Text variant="h2">›</Text>
          </Pressable>
        </View>
        <Button label="후보로 추가" variant="secondary" block onPress={addDate} style={{ marginTop: space.sm }} />

        {/* 추가된 후보 */}
        <View style={styles.chips}>
          {dates.map((d) => (
            <Pressable key={d} onPress={() => setDates(dates.filter((x) => x !== d))} style={styles.chip}>
              <Text variant="caption">{formatKo(d)} ✕</Text>
            </Pressable>
          ))}
          {dates.length === 0 ? (
            <Text variant="bodySm" color={colors.light.textSecondary}>후보 날짜를 추가하세요.</Text>
          ) : null}
        </View>

        {/* 기한 */}
        <View style={styles.deadlineRow}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>투표 기한</Text>
          <View style={styles.stepperSm}>
            <Pressable onPress={() => diffDays(deadline, first) > 0 && setDeadline(addDays(deadline, -1))} hitSlop={10} style={styles.stepBtn}>
              <Text variant="h2">‹</Text>
            </Pressable>
            <Text variant="bodyBold" style={{ fontSize: 14 }}>{formatKo(deadline)}</Text>
            <Pressable onPress={() => setDeadline(addDays(deadline, 1))} hitSlop={10} style={styles.stepBtn}>
              <Text variant="h2">›</Text>
            </Pressable>
          </View>
        </View>

        <Button
          label={saving ? '시작 중…' : '투표 시작'}
          block
          loading={saving}
          disabled={dates.length === 0}
          onPress={() => onSubmit(dates, deadline)}
          style={{ marginTop: space.lg }}
        />
        <Button label="취소" variant="ghost" block onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: { backgroundColor: colors.light.paper, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, padding: space.screen, paddingBottom: space.section },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.light.hairlineStrong, borderRadius: radius.button, paddingHorizontal: space.md, height: 48, marginTop: space.lg },
  stepperSm: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md, minHeight: 24 },
  chip: { backgroundColor: colors.light.cobalt12, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  deadlineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg },
});
