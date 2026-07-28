/**
 * GaugeCell — 시그니처 요소 2. 달력 한 칸: 날짜 + 하단 6칸 미니 게이지.
 * 6명이라는 사실을 채도가 아니라 "칸 수"로 보여준다.
 * 가능한 사람은 1/6칸씩 각자의 프로필 색으로 칠한다(들어온 순서대로 append, 정렬하지 않는다).
 * 전원 가능하면 여섯 칸이 각자 색으로 꽉 찬다.
 * 배경 연두 그라데이션은 그 달에서 가능 인원이 많은 순위(tier)로만 칠한다 — 순위는 호출부가 계산한다.
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
  tier?: number; // 가능 인원 내림차순 순위(0=가장 많은 날, 1, 2). 없으면 하이라이트 없음
  marked?: boolean; // 확정된 모임 날짜
  onPress?: () => void;
};

/**
 * 칸 수는 정원(6)으로 고정한다. 지금 가입한 멤버가 3명이어도 6칸을 그리고
 * 남는 칸은 미등록(회색)으로 둔다 — "6명"이 이 앱의 대전제이기 때문.
 */
export const SLOTS = 6;

/** 순위별 배경색 — 0순위(가능 최다)가 가장 진한 연두, 뒤로 갈수록 채도 down. */
export const TIER_COLORS = [colors.light.availAll, colors.light.availHigh, colors.light.availMid];

// 6칸을 상태 순서(가능→미정→불가→미입력)로 채운 색 배열. 모자라면 미등록 색으로 채운다.
// 가능 칸은 그 멤버의 프로필 색을 쓰고, 색이 없는 멤버만 기본색으로 떨어진다.
function gaugeColors(c: DayCounts, availColors: string[]): string[] {
  const seq: string[] = [];
  for (let i = 0; i < c.available; i++) seq.push(availColors[i] ?? colors.light.available);
  for (let i = 0; i < c.maybe; i++) seq.push(colors.light.maybe);
  for (let i = 0; i < c.unavailable; i++) seq.push(colors.light.unavailable);
  while (seq.length < SLOTS) seq.push(colors.light.missing);
  return seq.slice(0, SLOTS);
}

export function GaugeCell({ date, day, inMonth, counts, availColors = [], tier, marked, onPress }: Props) {
  const allAvailable = counts.available >= SLOTS;
  const tint = inMonth && tier != null ? TIER_COLORS[tier] ?? null : null;
  const segments = gaugeColors(counts, availColors);

  const label = `${day}일, ${allAvailable ? `${SLOTS}명 모두 가능` : `가능 ${counts.available}명`}`;

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
