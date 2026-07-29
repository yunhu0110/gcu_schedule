/**
 * GaugeCell — 시그니처 요소 2. 달력 한 칸: 날짜 + 하단 두 줄 미니 게이지.
 * 윗줄 = '가능' 인원(파란 칸), 아랫줄 = '불가' 인원(빨간 칸). 각 줄 6칸 고정(정원 6명).
 * 배경 하이라이트는 "가능 인원 수"로만 준다 — 6명=가장 진한 연두, 5명=덜, 4명=더 옅게, 3명 이하=없음.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '@/theme/tokens';
import { Text } from './Text';
import type { DateStr } from '@/lib/date';

export type DayCounts = {
  available: number;
  maybe: number;
  unavailable: number;
  missing: number;
};

type Props = {
  date: DateStr;
  day: number; // 표시 숫자 (1~31)
  inMonth: boolean;
  counts: DayCounts;
  marked?: boolean; // 확정된 모임 날짜
  onPress?: () => void;
};

/**
 * 칸 수는 정원(6)으로 고정한다. 지금 가입한 멤버가 3명이어도 6칸을 그리고
 * 남는 칸은 미등록(회색)으로 둔다 — "6명"이 이 앱의 대전제이기 때문.
 */
export const SLOTS = 6;

/** 가능 인원 수 → 배경 연두. 6명=가장 진함, 5명·4명 순으로 옅게, 3명 이하=하이라이트 없음(하양). */
function countTint(n: number): string | null {
  if (n >= 6) return colors.light.availAll;
  if (n === 5) return colors.light.availHigh;
  if (n === 4) return colors.light.availMid;
  return null;
}

/** n칸을 채운 6칸 boolean 배열. */
function row(n: number): boolean[] {
  return Array.from({ length: SLOTS }, (_, i) => i < n);
}

export function GaugeCell({ date, day, inMonth, counts, marked, onPress }: Props) {
  const allAvailable = counts.available >= SLOTS;
  const tint = inMonth ? countTint(counts.available) : null;
  const avail = row(counts.available);
  const unavail = row(counts.unavailable);

  const label = `${day}일, 가능 ${counts.available}명 · 불가 ${counts.unavailable}명`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.cell,
        !inMonth && styles.outMonth,
        tint ? [styles.tintCell, { backgroundColor: tint }] : null,
        marked && styles.markedCell,
      ]}
    >
      <Text
        variant="mono"
        style={styles.num}
        color={inMonth ? colors.light.textPrimary : colors.light.ink24}
      >
        {day}
      </Text>
      {inMonth && (
        <View style={styles.gauges}>
          <View style={styles.gaugeRow}>
            {avail.map((on, i) => (
              <View key={i} style={[styles.seg, on ? styles.segAvail : styles.segEmpty]} />
            ))}
          </View>
          <View style={styles.gaugeRow}>
            {unavail.map((on, i) => (
              <View key={i} style={[styles.seg, on ? styles.segUnavail : styles.segEmpty]} />
            ))}
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: `${100 / 7}%`,
    height: 60,
    paddingTop: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  outMonth: { opacity: 0.5 },
  markedCell: { borderWidth: 2, borderColor: colors.light.cobalt, borderRadius: 8 },
  tintCell: { borderRadius: 8 },
  num: { fontSize: 13, letterSpacing: 0 },
  gauges: { marginTop: 6, width: '86%', gap: 2 },
  gaugeRow: { flexDirection: 'row', gap: 1 },
  seg: { flex: 1, height: 5, borderRadius: 2 },
  segAvail: { backgroundColor: colors.light.available },
  segUnavail: { backgroundColor: colors.light.danger },
  segEmpty: { backgroundColor: colors.light.missing },
});
