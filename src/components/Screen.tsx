/**
 * Screen — 모든 화면의 바깥 래퍼. 안전영역 + paper 배경 + 좌우 화면 여백.
 *
 * 키보드: Android도 padding으로 직접 피한다. edge-to-edge(SDK 54 기본)에서는
 * adjustResize로 창이 줄지 않아 입력창이 키보드에 가려지기 때문.
 * 스크롤 화면은 키보드가 뜨면 뷰포트가 줄어들어 입력창까지 스크롤할 수 있다.
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
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            automaticallyAdjustKeyboardInsets
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.inner, padded && styles.padded]}>{children}</View>
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
