/**
 * Button — primary(cobalt 채움) / secondary(ink-24 아웃라인) / ghost.
 * hifi: 높이 48, 라운드 14, 700, 15px. 문구는 일어날 일을 그대로 쓴다.
 */
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, fonts, layout, radius, space } from '@/theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  style?: ViewStyle;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, block, style }: Props) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        block && styles.block,
        variantStyles[variant],
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.light.paper : colors.light.cobalt} />
      ) : (
        <Text color={labelColor[variant]} style={styles.label}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: layout.buttonHeight,
    borderRadius: radius.button,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  block: { width: '100%' },
  label: { fontFamily: fonts.bodyBold, fontSize: 15 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.4 },
});

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.light.cobalt },
  secondary: { backgroundColor: 'transparent', borderColor: colors.light.ink24 },
  ghost: { backgroundColor: 'transparent' },
};

const labelColor: Record<Variant, string> = {
  primary: colors.light.paper,
  secondary: colors.light.textPrimary,
  ghost: colors.light.cobalt,
};
