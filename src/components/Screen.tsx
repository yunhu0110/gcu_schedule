/**
 * Screen — 모든 화면의 바깥 래퍼. 안전영역 + paper 배경 + 좌우 화면 여백.
 * iOS는 KeyboardAvoidingView(padding), Android는 기본 adjustResize로 키보드를 피한다.
 */
import { createContext, useContext, useRef, type ReactNode, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';

/**
 * 화면 ScrollView 핸들 — 하위 입력칸이 포커스될 때 자기 자신을 키보드 위로 스크롤하는 데 쓴다.
 * automaticallyAdjustKeyboardInsets는 인셋만 늘려줄 뿐 포커스 입력칸으로 스크롤해주진 않으므로 필요.
 */
const ScreenScrollContext = createContext<RefObject<ScrollView | null> | null>(null);
export const useScreenScroll = () => useContext(ScreenScrollContext);

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean; // 좌우 화면 여백 적용 (기본 true)
  edges?: Edge[];
};

export function Screen({ children, scroll = false, padded = true, edges = ['top', 'bottom'] }: Props) {
  const ios = Platform.OS === 'ios';
  const scrollRef = useRef<ScrollView>(null);
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {/* 스크롤 화면은 ScrollView가 키보드 인셋을 직접 처리(automaticallyAdjustKeyboardInsets)하고,
          입력칸은 포커스 시 useScreenScroll()로 자기를 위로 스크롤한다.
          비스크롤 화면만 KeyboardAvoidingView(padding)로 피한다 — 둘이 겹치면 이중으로 밀린다. */}
      <ScreenScrollContext.Provider value={scrollRef}>
        <KeyboardAvoidingView style={styles.flex} behavior={!scroll && ios ? 'padding' : undefined}>
          {scroll ? (
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[styles.scrollContent, padded && styles.padded]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets={ios}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.inner, padded && styles.padded]}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </ScreenScrollContext.Provider>
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
