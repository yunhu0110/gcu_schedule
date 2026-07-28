/**
 * Screen — 모든 화면의 바깥 래퍼. 안전영역 + paper 배경 + 좌우 화면 여백.
 */
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean; // 좌우 화면 여백 적용 (기본 true)
  edges?: Edge[];
};

export function Screen({ children, scroll = false, padded = true, edges = ['top', 'bottom'] }: Props) {
  const inner = <View style={[styles.inner, padded && styles.padded]}>{children}</View>;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  flex: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { paddingVertical: space.xl, flexGrow: 1 },
  padded: { paddingHorizontal: space.screen },
});
