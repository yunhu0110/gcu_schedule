/**
 * AnimatedHeading — 제목+서브타이틀이 Stagger로 한 줄씩 순서대로 등장(Ease out).
 * 제목 먼저, 서브타이틀은 약간 늦게(delay). 들어오는 움직임이라 Ease out.
 */
import { type ReactNode } from 'react';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Text } from './Text';
import { colors } from '@/theme/tokens';

const ease = Easing.out(Easing.cubic);
const titleIn = FadeInDown.duration(320).easing(ease);
const subIn = FadeInDown.delay(90).duration(320).easing(ease);

export function AnimatedHeading({
  title,
  subtitle,
  color = colors.light.textPrimary,
  subColor = colors.light.textSecondary,
  subStyle,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  color?: string;
  subColor?: string;
  subStyle?: object;
}) {
  return (
    <>
      <Animated.View entering={titleIn}>
        <Text variant="h1" color={color}>{title}</Text>
      </Animated.View>
      {subtitle != null ? (
        <Animated.View entering={subIn} style={subStyle}>
          <Text variant="bodySm" color={subColor}>{subtitle}</Text>
        </Animated.View>
      ) : null}
    </>
  );
}
