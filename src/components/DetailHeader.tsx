/**
 * DetailHeader — 상세/입력 화면 상단바. 뒤로가기(‹) + 선택적 우측 액션.
 * 하단 네비가 숨겨지는 화면에서 뒤로가기를 제공한다(요청서 3-3).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { colors, space } from '@/theme/tokens';

export function DetailHeader({ right, onBack }: { right?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.bar}>
      <Pressable onPress={onBack ?? (() => router.back())} hitSlop={12} style={styles.back}>
        <Text variant="h2" color={colors.light.ink}>‹</Text>
      </Pressable>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 44 },
  back: { width: 40, height: 44, justifyContent: 'center' },
  right: { flexDirection: 'row', alignItems: 'center' },
});
