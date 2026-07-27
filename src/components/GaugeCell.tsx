/**
 * GaugeCell — 시그니처 요소 2. 달력 한 칸: 날짜 + 하단 6칸 미니 게이지.
 * 6명이라는 사실을 채도가 아니라 "칸 수"로 보여준다.
 * 전원 가능(all)한 날은 셀 전체 neon + 숫자 흰색 반전.
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
  onPress?: () => void;
};

// 6칸을 상태 순서(가능→미정→불가→미입력)로 채운 색 배열
function gaugeColors(c: DayCounts): string[] {
  const seq: string[] = [];
  for (let i = 0; i < c.available; i++) seq.push(colors.light.available);
  for (let i = 0; i < c.maybe; i++) seq.push(colors.light.maybe);
  for (let i = 0; i < c.unavailable; i++) seq.push(colors.light.unavailable);
  for (let i = 0; i < c.missing; i++) seq.push(colors.light.missing);
  return seq.slice(0, 6);
}

export function GaugeCell({ date, day, inMonth, counts, onPress }: Props) {
  const total = counts.available + counts.maybe + counts.unavailable + counts.missing;
  const allAvailable = total > 0 && counts.available === total;
  const segments = gaugeColors(counts);

  const label = `${day}일, ${allAvailable ? '6명 모두 가능' : `가능 ${counts.available}명`}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.cell, !inMonth && styles.outMonth, allAvailable && styles.allCell]}
    >
      <Text
        variant="mono"
        style={styles.num}
        color={allAvailable ? colors.light.paper : inMonth ? colors.light.textPrimary : colors.light.ink24}
      >
        {day}
      </Text>
      {inMonth && !allAvailable && (
        <View style={styles.gauge}>
          {segments.map((c, i) => (
            <View key={i} style={[styles.seg, { backgroundColor: c }]} />
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: `${100 / 7}%`,
    height: 52,
    paddingTop: 6,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  outMonth: { opacity: 0.5 },
  allCell: {
    backgroundColor: colors.light.neon,
    borderRadius: 8,
    justifyContent: 'center',
  },
  num: { fontSize: 13, letterSpacing: 0 },
  gauge: { flexDirection: 'row', gap: 1, marginTop: 8, width: '86%' },
  seg: { flex: 1, height: 4, borderRadius: 1 },
});
