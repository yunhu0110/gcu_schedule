/**
 * TextField — 라벨 + 입력. 헤어라인 밑줄/테두리, 토큰 기반.
 */
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { Text } from './Text';

type Props = TextInputProps & { label?: string };

export function TextField({ label, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="caption" color={colors.light.textSecondary}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.light.slate}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.light.hairlineStrong,
    borderRadius: radius.button,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.light.textPrimary,
    backgroundColor: colors.light.paper,
  },
});
