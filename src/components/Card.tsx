/**
 * Card — 리디자인(토스풍): 흰 카드 + 소프트 섀도로 떠 있는 느낌(헤어라인 제거).
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, space } from '@/theme/tokens';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.paper,
    borderRadius: radius.soft,
    padding: space.lg,
    ...shadow.soft,
  },
});
