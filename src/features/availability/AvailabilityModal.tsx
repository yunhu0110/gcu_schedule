/**
 * AvailabilityModal — 달력에서 날짜를 누르면 뜨는 일정 입력 팝업.
 * "언제부터 언제까지 · 상태(불가/가능/미정) · 사유"를 받아 상위(달력)로 넘긴다.
 * 저장(upsert)·쿼리 무효화는 호출부(calendar)가 담당. 이 컴포넌트는 입력 UI만.
 * 참조: 05-SCHEDULING-LOGIC §1 상태 정의.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { colors, radius, space } from '@/theme/tokens';
import { addDays, diffDays, formatKo, type DateStr } from '@/lib/date';
import type { AvailabilityStatus } from '@/api/availabilities';

export type AvailabilitySubmit = {
  status: AvailabilityStatus;
  from: DateStr;
  to: DateStr;
  note: string;
};

type Props = {
  visible: boolean;
  date: DateStr | null; // 탭한 날짜(시작 기본값)
  saving?: boolean;
  onClose: () => void;
  onSubmit: (v: AvailabilitySubmit) => void;
};

const OPTIONS: { key: AvailabilityStatus; label: string; color: string }[] = [
  { key: 'unavailable', label: '불가', color: colors.light.unavailable },
  { key: 'maybe', label: '미정', color: colors.light.maybe },
  { key: 'available', label: '가능', color: colors.light.available },
];

export function AvailabilityModal({ visible, date, saving, onClose, onSubmit }: Props) {
  const [status, setStatus] = useState<AvailabilityStatus>('unavailable');
  const [from, setFrom] = useState<DateStr | null>(date);
  const [to, setTo] = useState<DateStr | null>(date);
  const [note, setNote] = useState('');

  // 새 날짜로 열릴 때 값 초기화
  useEffect(() => {
    if (visible) {
      setStatus('unavailable');
      setFrom(date);
      setTo(date);
      setNote('');
    }
  }, [visible, date]);

  if (!from || !to) return null;

  // to가 from보다 앞서지 않게 보정
  function setFromSafe(next: DateStr) {
    setFrom(next);
    if (to && diffDays(to, next) < 0) setTo(next);
  }
  function setToSafe(next: DateStr) {
    if (from && diffDays(next, from) < 0) return; // from보다 앞으로 못 감
    setTo(next);
  }

  const days = Math.abs(diffDays(to, from)) + 1;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">일정 입력</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          이 기간을 아래 상태로 표시해요{days > 1 ? ` (${days}일)` : ''}.
        </Text>

        {/* 상태 선택 */}
        <View style={styles.statusRow}>
          {OPTIONS.map((o) => {
            const on = status === o.key;
            return (
              <Pressable
                key={o.key}
                onPress={() => setStatus(o.key)}
                style={[styles.chip, { borderColor: o.color }, on && { backgroundColor: o.color }]}
              >
                <Text
                  variant="bodyBold"
                  style={{ fontSize: 15 }}
                  color={on ? colors.light.paper : o.color}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 기간 */}
        <View style={styles.rangeBlock}>
          <DateStepper label="시작" value={from} onChange={setFromSafe} />
          <DateStepper label="종료" value={to} onChange={setToSafe} min={from} />
        </View>

        {/* 사유 */}
        <TextField
          label="사유 (선택)"
          value={note}
          onChangeText={setNote}
          placeholder="예: 출장, 시험기간, 가족 행사"
          style={{ marginTop: space.md }}
        />

        <Button
          label={saving ? '저장 중…' : '저장'}
          block
          loading={saving}
          onPress={() => onSubmit({ status, from, to, note })}
          style={{ marginTop: space.lg }}
        />
        <Button label="취소" variant="ghost" block onPress={onClose} />
      </View>
    </Modal>
  );
}

function DateStepper({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: DateStr;
  onChange: (d: DateStr) => void;
  min?: DateStr;
}) {
  const atMin = min ? diffDays(value, min) <= 0 : false;
  return (
    <View style={styles.stepper}>
      <Text variant="caption" color={colors.light.textSecondary}>
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => !atMin && onChange(addDays(value, -1))}
          hitSlop={10}
          style={[styles.stepBtn, atMin && styles.stepBtnOff]}
        >
          <Text variant="h2" color={atMin ? colors.light.ink24 : colors.light.ink}>
            ‹
          </Text>
        </Pressable>
        <Text variant="bodyBold" style={styles.stepVal}>
          {formatKo(value)}
        </Text>
        <Pressable onPress={() => onChange(addDays(value, 1))} hitSlop={10} style={styles.stepBtn}>
          <Text variant="h2" color={colors.light.ink}>
            ›
          </Text>
        </Pressable>
      </View>
    </View>
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
    gap: space.xs,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.light.hairlineStrong,
    alignSelf: 'center',
    marginBottom: space.md,
  },
  statusRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  chip: {
    flex: 1,
    height: 44,
    borderRadius: radius.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeBlock: { marginTop: space.lg, gap: space.md },
  stepper: { gap: space.xs },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.light.hairlineStrong,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    height: 48,
  },
  stepBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepBtnOff: { opacity: 0.4 },
  stepVal: { fontSize: 15 },
});
