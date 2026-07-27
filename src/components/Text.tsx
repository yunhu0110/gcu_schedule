/**
 * Text — 타이포 프리셋 컴포넌트. 화면에서 폰트 크기/색을 직접 쓰지 않고 이걸 쓴다.
 * NOTE: 커스텀 서체(명조/Pretendard/Mono) 프리로드는 다음 단계(M0-2b). 지금은 시스템 폰트 +
 *       굵기로 위계를 표현하고, 폰트 로드 후 tokens.fonts의 fontFamily를 붙인다.
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, type as typeScale } from '@/theme/tokens';

type Variant = keyof typeof typeScale;
type Weight = '400' | '500' | '600' | '700';

// 변형별 굵기 폴백 (커스텀 폰트 로드 전까지 위계 유지용)
const weightByVariant: Record<Variant, Weight> = {
  display: '700',
  h1: '700',
  h2: '600',
  body: '400',
  bodySm: '400',
  caption: '400',
  mono: '500',
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  color?: string;
};

export function Text({ variant = 'body', color, style, ...rest }: TextProps) {
  const preset = typeScale[variant];
  // fontFamily는 아직 적용하지 않는다(폰트 미로드). 나머지 속성만 사용.
  const { fontFamily: _ignore, ...typeStyle } = preset as typeof preset & { fontFamily?: string };
  return (
    <RNText
      style={[
        typeStyle,
        { fontWeight: weightByVariant[variant], color: color ?? colors.light.textPrimary },
        style,
      ]}
      {...rest}
    />
  );
}
