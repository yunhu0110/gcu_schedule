/**
 * AnimatedCheck — 체크 표시의 선이 그려지는 체크 아이콘. 체크될 때 Ease in out으로 draw.
 * strokeDasharray/offset을 애니메이트해 'ㄴ'자 체크가 그어지는 느낌.
 */
import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const LEN = 20; // 체크 경로 대략 길이

export function AnimatedCheck({ checked, size = 16, color = '#fff' }: { checked: boolean; size?: number; color?: string }) {
  const draw = useSharedValue(checked ? 1 : 0);
  useEffect(() => {
    draw.value = withTiming(checked ? 1 : 0, { duration: 260, easing: Easing.inOut(Easing.ease) });
  }, [checked, draw]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: LEN * (1 - draw.value) }));
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d="M5 12.5l4 4 10-10"
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={LEN}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
