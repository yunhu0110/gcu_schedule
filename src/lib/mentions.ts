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
