/**
 * Supabase 클라이언트 — 기존 gcu_schedule Supabase 프로젝트 재사용(RLS + Realtime + RPC).
 * anon 키만 사용(브라우저 공개 가능). service_role 키는 절대 넣지 않는다.
 * 값은 .env.local(VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)에서 주입.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // 빌드는 통과시키되 런타임에 명확히 알린다(값 미설정 시).
  console.warn(
    '[hidden-word] Supabase 환경변수가 없습니다. apps/hidden-word/.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.',
  );
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'public-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 10 } },
});

export const hasSupabaseConfig = Boolean(url && anonKey);
