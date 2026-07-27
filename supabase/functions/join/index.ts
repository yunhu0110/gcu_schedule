// join — 초대 코드 검증 → auth 유저 생성 → members 행 생성 → 코드 소모.
// service_role 키로 실행되어 RLS/트리거를 다룬다. (service_role는 Edge 런타임이 자동 주입)
// 클라이언트는 이 함수를 호출한 뒤 email/password로 로그인한다.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'POST만 허용됩니다.' });

  let payload: { code?: string; email?: string; password?: string; nickname?: string; avatar_url?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: '잘못된 요청이에요.' });
  }

  const code = payload.code?.trim();
  const email = payload.email?.trim().toLowerCase();
  const { password, nickname, avatar_url } = payload;

  if (!code || !email || !password || !nickname) {
    return json({ ok: false, error: '초대 코드, 이메일, 비밀번호, 닉네임을 모두 입력해주세요.' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  // 1) 초대 코드 검증
  const { data: invite, error: inviteErr } = await admin
    .from('invite_codes')
    .select('code, used_by, expires_at')
    .eq('code', code)
    .maybeSingle();

  if (inviteErr) return json({ ok: false, error: '코드를 확인하지 못했어요. 잠시 후 다시 시도해주세요.' });
  if (!invite) return json({ ok: false, error: '없는 초대 코드예요.' });
  if (invite.used_by) return json({ ok: false, error: '이미 사용된 코드예요.' });
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return json({ ok: false, error: '만료된 코드예요.' });
  }

  // 2) 정원 사전 확인 (트리거가 최종 강제)
  const { count } = await admin
    .from('members')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if ((count ?? 0) >= 6) return json({ ok: false, error: '정원이 가득 찼어요 (6명).' });

  // 3) auth 유저 생성
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nickname },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message?.includes('already') ? '이미 가입된 이메일이에요.' : '계정을 만들지 못했어요.';
    return json({ ok: false, error: msg });
  }
  const userId = created.user.id;

  // 4) members 행 생성 (6인 트리거가 여기서 최종 강제)
  const { error: memberErr } = await admin
    .from('members')
    .insert({ id: userId, nickname, avatar_url: avatar_url ?? null, is_admin: false });
  if (memberErr) {
    await admin.auth.admin.deleteUser(userId); // 롤백: 고아 계정 제거
    const full = memberErr.message?.includes('정원');
    return json({ ok: false, error: full ? '정원이 가득 찼어요 (6명).' : '멤버 등록에 실패했어요.' });
  }

  // 5) 초대 코드 소모
  await admin
    .from('invite_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code);

  return json({ ok: true });
});
