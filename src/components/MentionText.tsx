/**
 * MentionText — 댓글 본문을 렌더링하되 @멘션 부분만 색을 입혀 강조한다.
 * 멘션 색은 언급된 멤버 본인 색(없으면 action)으로, 살짝 굵게.
 */
import { Text, type TextProps } from './Text';
import { colors } from '@/theme/tokens';
import { splitMentions } from '@/lib/mentions';

type MemberLite = { id: string; nickname: string; color?: string | null };

type Props = TextProps & {
  body: string;
  members: MemberLite[];
};

export function MentionText({ body, members, variant = 'body', style, ...rest }: Props) {
  const parts = splitMentions(body, members);
  return (
    <Text variant={variant} style={style} {...rest}>
      {parts.map((p, i) =>
        p.memberId ? (
          <Text
            key={i}
            variant={variant}
            color={members.find((m) => m.id === p.memberId)?.color ?? colors.light.action}
            style={{ fontWeight: '700' }}
          >
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}
