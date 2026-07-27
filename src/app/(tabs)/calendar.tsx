/**
 * S2. 달력 — 6칸 게이지 월 그리드가 들어갈 자리. 지금은 구조 + 범례 플레이스홀더.
 * 실제 그리드/집계/입력은 M1(availabilities + availability_summary)에서 구현.
 */
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, space } from '@/theme/tokens';
import { volLabel, todayStr } from '@/lib/date';

const legend = [
  { label: '가능', color: colors.light.available },
  { label: '불가', color: colors.light.unavailable },
  { label: '미정', color: colors.light.maybe },
  { label: '미입력', color: colors.light.missing },
];

export default function CalendarScreen() {
  return (
    <Screen scroll>
      <Text variant="h1">{volLabel(todayStr())}</Text>
      <View style={{ marginTop: space.xl }}>
        <SectionHeader label="6칸 게이지 달력 (구현 예정)" />
        <Card>
          <Text variant="body" color={colors.light.textSecondary}>
            멤버가 정확히 6명이라, 날짜마다 6칸 게이지로 가능/불가를 셉니다.
          </Text>
          <View style={styles.legendRow}>
            {legend.map((l) => (
              <View key={l.label} style={styles.legendItem}>
                <View style={[styles.swatch, { backgroundColor: l.color }]} />
                <Text variant="caption" color={colors.light.textSecondary}>
                  {l.label}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, marginTop: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  swatch: { width: 14, height: 14, borderRadius: 2, borderWidth: 1, borderColor: colors.light.hairline },
});
