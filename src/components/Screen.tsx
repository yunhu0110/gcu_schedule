/**
 * Screen — 모든 화면의 바깥 래퍼. 안전영역 + paper 배경 + 좌우 화면 여백.
 * 스크롤 화면은 KeyboardAwareScrollView로 감싸 입력창이 키보드에 가리지 않게 자동 스크롤한다.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
      {scroll ? (
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid
          extraScrollHeight={24}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.inner, padded && styles.padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.light.bg },
  inner: { flex: 1 },
  scrollContent: { paddingVertical: space.xl, flexGrow: 1 },
  padded: { paddingHorizontal: space.screen },
});
