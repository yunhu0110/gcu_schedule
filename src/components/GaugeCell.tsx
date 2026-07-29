/**
 * GaugeCell — 시그니처 요소 2. 달력 한 칸: 날짜 + 하단 6칸 미니 게이지.
 * 6명이라는 사실을 채도가 아니라 "칸 수"로 보여준다.
 * 가능한 사람은 1/6칸씩 각자의 프로필 색으로 칠한다(들어온 순서대로 append, 정렬하지 않는다).
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
  availColors?: string[]; // 가능한 멤버들의 프로필 색 (등록 순서 그대로)
  marked?: boolean; // 확정된 모임 날짜
  onPress?: () => void;
  onLongPress?: () => void; // 꾹 누르기 — 그 날 내 일정 지우기
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

// 게이지에는 '가능(참가)'만 채운다. 불가·미정·미입력은 빈 칸(미등록 색).
// 가능 칸은 그 멤버의 프로필 색을 쓰고, 색이 없는 멤버만 기본색으로 떨어진다.
function gaugeColors(c: DayCounts, availColors: string[]): string[] {
  const seq: string[] = [];
  for (let i = 0; i < c.available; i++) seq.push(availColors[i] ?? colors.light.available);
  while (seq.length < SLOTS) seq.push(colors.light.missing);
  return seq.slice(0, SLOTS);
}

export function GaugeCell({ date, day, inMonth, counts, availColors = [], marked, onPress, onLongPress }: Props) {
  const allAvailable = counts.available >= SLOTS;
  const tint = inMonth ? countTint(counts.available) : null;
  const segments = gaugeColors(counts, availColors);

  const label = `${day}일, ${allAvailable ? `${SLOTS}명 모두 가능` : `가능 ${counts.available}명`}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
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
