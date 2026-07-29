/**
 * MentionInput — 코멘트 입력. @ 입력 시 멤버 제안 목록이 위에 떠서 @닉네임을 넣어준다.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { TextField } from './TextField';
import { colors, radius, space } from '@/theme/tokens';

type MemberLite = { id: string; nickname: string; color?: string | null };

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  members: MemberLite[];
  placeholder?: string;
  style?: object; // 바깥 컨테이너
  inputStyle?: object; // 안쪽 TextField
  onFocus?: () => void;
  onBlur?: () => void;
};

export function MentionInput({ value, onChangeText, members, placeholder, style, inputStyle, onFocus, onBlur }: Props) {
  const match = value.match(/@([^\s@]{0,20})$/);
  const query = match?.[1] ?? null;
  // 대소문자 무시하고 "같은 글자로 시작하면" 바로 뜨게(startsWith). @만 치면 전체가 뜬다.
  const suggestions =
    query != null
      ? members.filter((m) => m.nickname.toLowerCase().startsWith(query.toLowerCase())).slice(0, 5)
      : [];

  function pick(nickname: string) {
    if (!match) return;
    const base = value.slice(0, value.length - match[0].length);
    onChangeText(`${base}@${nickname} `);
  }

  return (
    <View style={style}>
      {suggestions.length > 0 ? (
        <View style={styles.suggest}>
          {suggestions.map((m) => (
            <Pressable key={m.id} onPress={() => pick(m.nickname)} style={styles.sRow}>
              <View style={[styles.dot, { backgroundColor: m.color ?? colors.light.cobalt }]} />
              <Text variant="bodySm">@{m.nickname}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <TextField value={value} onChangeText={onChangeText} placeholder={placeholder} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
    </View>
  );
}

const styles = StyleSheet.create({
  suggest: {
    backgroundColor: colors.light.paper,
    borderWidth: 1,
    borderColor: colors.light.hairline,
    borderRadius: radius.card,
    marginBottom: space.xs,
    overflow: 'hidden',
  },
  sRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
