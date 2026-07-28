/**
 * 코멘트 맨션(@닉네임) 유틸 — 본문에서 @닉네임을 찾아 해당 멤버 id를 돌려준다.
 */
type MemberLite = { id: string; nickname: string };

/** 본문에 @닉네임으로 언급된 멤버 id 목록(중복 제거). 닉네임이 긴 것부터 매칭. */
export function parseMentionIds(body: string, members: MemberLite[]): string[] {
  const ids = new Set<string>();
  const sorted = [...members].sort((a, b) => b.nickname.length - a.nickname.length);
  for (const m of sorted) {
    if (!m.nickname) continue;
    if (body.includes(`@${m.nickname}`)) ids.add(m.id);
  }
  return [...ids];
}

/** 본문 조각 — 일반 텍스트는 memberId=null, @멘션은 언급된 멤버 id. */
export type MentionPart = { text: string; memberId: string | null };

/**
 * 본문을 일반 텍스트와 @멘션 조각으로 나눈다. 닉네임이 긴 것부터 매칭(부분 겹침 방지).
 * 렌더링에서 멘션 조각만 색을 입히는 데 쓴다.
 */
export function splitMentions(body: string, members: MemberLite[]): MentionPart[] {
  const sorted = [...members].filter((m) => m.nickname).sort((a, b) => b.nickname.length - a.nickname.length);
  const parts: MentionPart[] = [];
  let buf = '';
  let i = 0;
  while (i < body.length) {
    if (body[i] === '@') {
      const rest = body.slice(i + 1);
      const hit = sorted.find((m) => rest.startsWith(m.nickname));
      if (hit) {
        if (buf) { parts.push({ text: buf, memberId: null }); buf = ''; }
        parts.push({ text: `@${hit.nickname}`, memberId: hit.id });
        i += 1 + hit.nickname.length;
        continue;
      }
    }
    buf += body[i];
    i += 1;
  }
  if (buf) parts.push({ text: buf, memberId: null });
  return parts;
}
