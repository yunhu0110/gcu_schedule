/**
 * SectionHeader — 모노 대문자 눈썹 라벨 + 좌측 얇은 잉크 바. 인쇄물 괘선 감각.
 */
import { StyleSheet, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { Text } from './Text';

export function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.bar} />
      <Text variant="mono" color={colors.light.textSecondary}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  bar: { width: 2, height: 14, backgroundColor: colors.light.ink },
});
