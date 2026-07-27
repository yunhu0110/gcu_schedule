/**
 * 인증 API — supabase.auth 접근은 여기(그리고 members.ts)를 통해서만.
 */
import { supabase } from '@/lib/supabase';

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export type JoinInput = {
  code: string;
  email: string;
  password: string;
  nickname: string;
  avatar_url?: string;
};

/**
 * 초대 코드 가입: join Edge Function 호출 → 성공 시 곧바로 로그인까지.
 * 반환: { ok, error? }
 */
export async function joinWithCode(input: JoinInput): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean; error?: string }>('join', {
    body: input,
  });
  if (error) return { ok: false, error: '가입 요청에 실패했어요. 잠시 후 다시 시도해주세요.' };
  if (!data?.ok) return { ok: false, error: data?.error ?? '가입에 실패했어요.' };

  // 가입 성공 → 바로 로그인
  const { error: signInErr } = await signIn(input.email, input.password);
  if (signInErr) return { ok: false, error: '가입은 됐지만 로그인에 실패했어요. 로그인 화면에서 다시 시도해주세요.' };
  return { ok: true };
}
