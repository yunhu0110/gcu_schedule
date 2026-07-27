/**
 * Text — 타이포 프리셋 컴포넌트. 화면에서 폰트 크기/색을 직접 쓰지 않고 이걸 쓴다.
 * 폰트는 루트에서 프리로드되므로(스플래시 게이팅) fontFamily를 그대로 적용한다.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  return (
    <RNText
      style={[typeScale[variant], { color: color ?? colors.light.textPrimary }, style]}
      {...rest}
    />
  );
}
