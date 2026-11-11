/**
 * Popup — 가운데 뜨는 팝업(모달). 뒤 배경 Fade로 어둡게 + 카드 Scale in(90%→100%).
 * 들어올 때 Ease out, 나갈 때 Ease in(공통 규칙). 지속 0.22s.
 * 나가는 애니메이션을 끝까지 보여주려고 종료 후에 언마운트한다.
 */
import { type ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const DUR_IN = 220;
const DUR_OUT = 200;

export function Popup({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const [mounted, setMounted] = useState(visible);
  const p = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      p.value = withTiming(1, { duration: DUR_IN, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      p.value = withTiming(0, { duration: DUR_OUT, easing: Easing.in(Easing.cubic) }, (fin) => {
        if (fin) runOnJS(setMounted)(false);
      });
    }
  }, [visible, mounted, p]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: p.value }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.9 + 0.1 * p.value }] }));

  if (!mounted) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={cardStyle} pointerEvents="box-none">{children}</Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,18,0.45)', justifyContent: 'center', paddingHorizontal: 24 },
});
