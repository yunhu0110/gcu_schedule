/**
 * GaugeCell — 시그니처 요소 2. 달력 한 칸: 날짜 + 하단 6칸 미니 게이지.
 * 6명이라는 사실을 채도가 아니라 "칸 수"로 보여준다.
 * 가능한 사람은 1/6칸씩 각자의 프로필 색으로 칠한다(들어온 순서대로 append, 정렬하지 않는다).
 * 전원 가능하면 여섯 칸이 각자 색으로 꽉 찬다.
 * 가능 인원이 많은 날은 셀 배경을 연두로 강조한다(전원 → 1명 빠짐 → 2명 빠짐 순으로 채도 down).
 * 3명 이하는 하이라이트 없이 게이지만 보여준다.
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
  availColors?: string[]; // 가능한 멤버들의 프로필 색 (등록 순서 그대로)
  total?: number; // 활성 멤버 수(기본 6) — 하이라이트 단계 기준
  marked?: boolean; // 확정된 모임 날짜
  onPress?: () => void;
};

const MIN_HIGHLIGHT = 4; // 4명 미만은 하이라이트 없음

/** 가능 인원 → 셀 배경색. 하이라이트가 없으면 null. */
function highlightColor(available: number, total: number): string | null {
  if (available < MIN_HIGHLIGHT) return null;
  const short = total - available; // 몇 명이 빠졌나
  if (short <= 0) return colors.light.availAll;
  if (short === 1) return colors.light.availHigh;
  if (short === 2) return colors.light.availMid;
  return null;
}

// 6칸을 상태 순서(가능→미정→불가→미입력)로 채운 색 배열.
// 가능 칸은 그 멤버의 프로필 색을 쓰고, 색이 없는 멤버만 기본색으로 떨어진다.
function gaugeColors(c: DayCounts, availColors: string[]): string[] {
  const seq: string[] = [];
  for (let i = 0; i < c.available; i++) seq.push(availColors[i] ?? colors.light.available);
  for (let i = 0; i < c.maybe; i++) seq.push(colors.light.maybe);
  for (let i = 0; i < c.unavailable; i++) seq.push(colors.light.unavailable);
  for (let i = 0; i < c.missing; i++) seq.push(colors.light.missing);
  return seq.slice(0, 6);
}

export function GaugeCell({ date, day, inMonth, counts, availColors = [], total = 6, marked, onPress }: Props) {
  const allAvailable = total > 0 && counts.available >= total;
  const tint = inMonth ? highlightColor(counts.available, total) : null;
  const segments = gaugeColors(counts, availColors);

  const label = `${day}일, ${allAvailable ? `${total}명 모두 가능` : `가능 ${counts.available}명`}`;

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
  markedCell: { borderWidth: 2, borderColor: colors.light.cobalt, borderRadius: 8 },
  tintCell: { borderRadius: 8 },
  num: { fontSize: 13, letterSpacing: 0 },
  gauge: { flexDirection: 'row', gap: 1, marginTop: 8, width: '86%' },
  seg: { flex: 1, height: 6, borderRadius: 2 },
});
