/**
 * 인증 API — supabase.auth 접근은 여기(그리고 members.ts)를 통해서만.
 * 가입은 초대코드 없는 단순 회원가입(ADR-009). 정원(6명)은 DB 트리거가 강제한다.
 */
import { supabase } from '@/lib/supabase';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export type SignUpInput = {
  email: string;
  password: string;
  nickname: string;
  avatar_url?: string;
};

/**
 * 단순 회원가입: auth.signUp → 세션 확보 → members 행 생성.
 * 이메일 확인(Confirm email)을 OFF로 둔 프로젝트 전제(SETUP 참조): signUp 직후 세션이 생겨
 * RLS(id = auth.uid())를 만족하는 members insert가 가능하다.
 * 정원 초과(6명)/중복 이메일은 사유를 그대로 문구로 돌려준다.
 * 반환: { ok, error? }
 */
export async function signUpMember(input: SignUpInput): Promise<{ ok: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase();
  const nickname = input.nickname.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { nickname } },
  });
  if (error) {
    const dup = /already|registered|exists/i.test(error.message);
    return { ok: false, error: dup ? '이미 가입된 이메일이에요.' : '계정을 만들지 못했어요. 잠시 후 다시 시도해주세요.' };
  }

  // 이메일 확인이 켜져 있으면 세션이 없다(가입은 됐지만 로그인 전). 그 경우 members insert가 RLS로 막힌다.
  let userId = data.session?.user.id ?? data.user?.id ?? null;
  if (!data.session) {
    // 세션 없으면 즉시 로그인 시도(확인 OFF 프로젝트면 이 경로를 타지 않음)
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (signInErr || !signInData.session) {
      return { ok: false, error: '가입 확인이 필요해요. 관리자에게 이메일 확인 설정을 확인해달라고 해주세요.' };
    }
    userId = signInData.session.user.id;
  }
  if (!userId) return { ok: false, error: '계정을 만들지 못했어요.' };

  const { error: memberErr } = await supabase
    .from('members')
    .insert({ id: userId, nickname, avatar_url: input.avatar_url ?? null });
  if (memberErr) {
    // 정원 초과 등 → 방금 만든 계정으로는 멤버가 못 되므로 로그아웃시켜 세션을 정리
    await supabase.auth.signOut();
    const full = memberErr.message?.includes('정원');
    return { ok: false, error: full ? '정원이 가득 찼어요 (6명).' : '멤버 등록에 실패했어요. 잠시 후 다시 시도해주세요.' };
  }

  return { ok: true };
}
