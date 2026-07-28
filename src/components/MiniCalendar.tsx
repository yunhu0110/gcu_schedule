/**
 * MiniCalendar — 팝업 안에서 쓰는 작은 월 달력. 날짜를 눌러 선택한다.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, space } from '@/theme/tokens';
import { addMonths, monthGrid, todayStr, volLabel, type DateStr } from '@/lib/date';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function MiniCalendar({ value, onChange }: { value: DateStr; onChange: (d: DateStr) => void }) {
  const [anchor, setAnchor] = useState(value || todayStr());
  const cells = monthGrid(anchor);
  const today = todayStr();

  // 7칸씩 주 단위로 쪼갠다(퍼센트 폭 반올림으로 7번째 칸이 줄바꿈되는 문제 방지).
  const weeks: { date: DateStr; inMonth: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => setAnchor(addMonths(anchor, -1))} hitSlop={10} style={styles.nav}><Text variant="h2">‹</Text></Pressable>
        <Text variant="bodyBold" style={{ fontSize: 15 }}>{volLabel(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonths(anchor, 1))} hitSlop={10} style={styles.nav}><Text variant="h2">›</Text></Pressable>
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((w, i) => (
          <View key={w} style={styles.cell}>
            <Text variant="caption" style={{ fontSize: 11 }} color={i === 0 ? colors.light.neon : colors.light.textSecondary}>{w}</Text>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.row}>
          {week.map((c) => {
            const sel = c.date === value;
            const isToday = c.date === today;
            return (
              <Pressable key={c.date} style={styles.cell} onPress={() => onChange(c.date)}>
                <View style={[styles.dayDot, sel && styles.selDot]}>
                  <Text
                    variant="bodySm"
                    color={sel ? colors.light.paper : !c.inMonth ? colors.light.ink24 : isToday ? colors.light.cobalt : colors.light.textPrimary}
                  >
                    {Number(c.date.slice(8, 10))}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  nav: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row' },
  cell: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center' },
  dayDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  selDot: { backgroundColor: colors.light.cobalt, borderRadius: radius.pill },
});
