/**
 * Button — primary(cobalt 채움) / secondary(헤어라인 아웃라인) / ghost.
 * 터치 타깃 44 이상. 문구는 일어날 일을 그대로 쓴다("날짜 확정하기").
 */
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, layout, radius, space } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.light.paper : colors.light.cobalt} />
      ) : (
        <Text variant="body" color={labelColor[variant]} style={styles.label}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouch,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: { fontWeight: '600' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.light.cobalt },
  secondary: { backgroundColor: colors.light.paper, borderWidth: 1, borderColor: colors.light.hairline },
  ghost: { backgroundColor: 'transparent' },
};

const labelColor: Record<Variant, string> = {
  primary: colors.light.paper,
  secondary: colors.light.textPrimary,
  ghost: colors.light.cobalt,
};
