/**
 * Card — 라운드 4, paper 배경, 그림자 대신 1px 헤어라인으로 구획.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.light.paper,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.light.hairline,
    padding: space.lg,
  },
});
