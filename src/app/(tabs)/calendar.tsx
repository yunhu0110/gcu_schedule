/**
 * S2. 달력 — 6칸 게이지 월 그리드(시그니처 요소 2). 월 이동 + 요일 헤더 + 전원가능 강조.
 * 지금은 가용성 데이터가 없어 날짜 기반 결정적 플레이스홀더로 채운다.
 * 실제 집계(availability_summary)·상태 입력·범위 선택은 M1.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { GaugeCell, type DayCounts } from '@/components/GaugeCell';
import { colors, space } from '@/theme/tokens';
import { addMonths, monthGrid, todayStr, volLabel } from '@/lib/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

// 날짜 문자열 기반 결정적 플레이스홀더 집계 (합 = 6). 실제 데이터는 M1.
function placeholderCounts(date: string): DayCounts {
  const n = [...date].reduce((a, c) => a + c.charCodeAt(0), 0);
  const available = n % 7; // 0..6
  let remaining = 6 - available;
  const unavailable = remaining >= 2 && n % 4 === 0 ? 1 : 0;
  remaining -= unavailable;
  const maybe = remaining >= 1 && n % 5 === 0 ? 1 : 0;
  const missing = 6 - available - unavailable - maybe;
  return { available, maybe, unavailable, missing };
}

export default function CalendarScreen() {
  const [anchor, setAnchor] = useState(todayStr());
  const cells = monthGrid(anchor);

  const allDays = cells.filter((c) => {
    if (!c.inMonth) return false;
    const cnt = placeholderCounts(c.date);
    return cnt.available === 6;
  });

  return (
    <Screen scroll>
      {/* 월 이동 */}
      <View style={styles.header}>
        <Pressable onPress={() => setAnchor(addMonths(anchor, -1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>
            ‹
          </Text>
        </Pressable>
        <Text variant="h1">{volLabel(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonths(anchor, 1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>
            ›
          </Text>
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            variant="mono"
            style={styles.weekCell}
            color={i === 0 ? colors.light.neon : colors.light.textSecondary}
          >
            {w}
          </Text>
        ))}
      </View>

      {/* 6칸 게이지 그리드 */}
      <View style={styles.grid}>
        {cells.map((c) => (
          <GaugeCell
            key={c.date}
            date={c.date}
            day={Number(c.date.slice(8, 10))}
            inMonth={c.inMonth}
            counts={placeholderCounts(c.date)}
          />
        ))}
      </View>

      {/* 하단 요약 */}
      <View style={styles.summary}>
        <View style={styles.dot} />
        <Text variant="bodySm" color={colors.light.textSecondary}>
          {allDays.length > 0
            ? `전원 가능한 날 ${allDays.length}개`
            : '전원 가능한 날이 아직 없어요'}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.hairline,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light.neon },
});
