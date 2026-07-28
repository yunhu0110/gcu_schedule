/**
 * AvailabilityModal — 달력에서 날짜를 누르면 뜨는 일정 입력 팝업.
 * "언제부터 언제까지 · 불가/가능 · (선택)시간대 · 사유"를 받아 상위(달력)로 넘긴다.
 * 저장(upsert)·쿼리 무효화는 호출부(calendar)가 담당. 이 컴포넌트는 입력 UI만.
 */
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
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
  startTime: string | null; // 'HH:MM' | null(하루 종일)
  endTime: string | null;
};

type Props = {
  visible: boolean;
  date: DateStr | null; // 탭한 날짜(시작 기본값)
  saving?: boolean;
  onClose: () => void;
  onSubmit: (v: AvailabilitySubmit) => void;
};

// 가능/불가 2종. (가능 먼저, 불가 오른쪽)
const OPTIONS: { key: AvailabilityStatus; label: string; color: string }[] = [
  { key: 'available', label: '가능', color: colors.light.available },
  { key: 'unavailable', label: '불가', color: colors.light.unavailable },
];

const STEP = 30; // 시간 스텝(분)
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toHHMM = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`;
};

export function AvailabilityModal({ visible, date, saving, onClose, onSubmit }: Props) {
  const [status, setStatus] = useState<AvailabilityStatus>('unavailable');
  const [from, setFrom] = useState<DateStr | null>(date);
  const [to, setTo] = useState<DateStr | null>(date);
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState('18:00');
  const [end, setEnd] = useState('21:00');
  const [note, setNote] = useState('');

  // 새 날짜로 열릴 때 값 초기화
  useEffect(() => {
    if (visible) {
      setStatus('unavailable');
      setFrom(date);
      setTo(date);
      setAllDay(true);
      setStart('18:00');
      setEnd('21:00');
      setNote('');
    }
  }, [visible, date]);

  if (!from || !to) return null;

  function setFromSafe(next: DateStr) {
    setFrom(next);
    if (to && diffDays(to, next) < 0) setTo(next);
  }
  function setToSafe(next: DateStr) {
    if (from && diffDays(next, from) < 0) return;
    setTo(next);
  }
  // start를 넘기면 end도 최소 30분 뒤로 밀어준다
  function setStartSafe(next: string) {
    setStart(next);
    if (toMin(end) <= toMin(next)) setEnd(toHHMM(toMin(next) + STEP));
  }
  function setEndSafe(next: string) {
    if (toMin(next) <= toMin(start)) return;
    setEnd(next);
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

        {/* 상태: 불가 / 가능 */}
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
        <View style={styles.block}>
          <Stepper label="시작일" value={formatKo(from)} onPrev={() => setFromSafe(addDays(from, -1))} onNext={() => setFromSafe(addDays(from, 1))} />
          <Stepper label="종료일" value={formatKo(to)} onPrev={() => setToSafe(addDays(to, -1))} onNext={() => setToSafe(addDays(to, 1))} prevOff={diffDays(to, from) <= 0} />
        </View>

        {/* 시간대 */}
        <View style={styles.allDayRow}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>
            하루 종일
          </Text>
          <Switch
            value={allDay}
            onValueChange={setAllDay}
            trackColor={{ true: colors.light.cobalt, false: colors.light.hairlineStrong }}
          />
        </View>
        {!allDay && (
          <View style={styles.block}>
            <Stepper label="시작 시간" value={start} onPrev={() => setStartSafe(toHHMM(toMin(start) - STEP))} onNext={() => setStartSafe(toHHMM(toMin(start) + STEP))} />
            <Stepper label="종료 시간" value={end} onPrev={() => setEndSafe(toHHMM(toMin(end) - STEP))} onNext={() => setEndSafe(toHHMM(toMin(end) + STEP))} prevOff={toMin(end) - STEP <= toMin(start)} />
          </View>
        )}

        {/* 사유 (예시 없음) */}
        <TextField label="사유 (선택)" value={note} onChangeText={setNote} style={{ marginTop: space.md }} />

        <Button
          label={saving ? '저장 중…' : '저장'}
          block
          loading={saving}
          onPress={() =>
            onSubmit({
              status,
              from,
              to,
              note,
              startTime: allDay ? null : start,
              endTime: allDay ? null : end,
            })
          }
          style={{ marginTop: space.lg }}
        />
        <Button label="취소" variant="ghost" block onPress={onClose} />
      </View>
    </Modal>
  );
}

function Stepper({
  label,
  value,
  onPrev,
  onNext,
  prevOff,
}: {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
  prevOff?: boolean;
}) {
  return (
    <View style={styles.stepper}>
      <Text variant="caption" color={colors.light.textSecondary}>
        {label}
      </Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => !prevOff && onPrev()} hitSlop={10} style={[styles.stepBtn, prevOff && styles.stepBtnOff]}>
          <Text variant="h2" color={prevOff ? colors.light.ink24 : colors.light.ink}>
            ‹
          </Text>
        </Pressable>
        <Text variant="bodyBold" style={styles.stepVal}>
          {value}
        </Text>
        <Pressable onPress={onNext} hitSlop={10} style={styles.stepBtn}>
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
  block: { marginTop: space.lg, gap: space.md },
  allDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
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
