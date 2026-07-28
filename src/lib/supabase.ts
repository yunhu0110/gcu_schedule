/**
 * Supabase 클라이언트 — 앱의 유일한 백엔드 진입점.
 * 컴포넌트에서 supabase.from()을 직접 부르지 않는다. src/api/*.ts 쿼리 함수를 통해서만 접근.
 *
 * 키: anon/publishable(공개) 키만 사용한다. service_role / sb_secret_ 키는 절대 클라이언트에 넣지 않는다.
 * 세션 보관은 src/lib/storage에 위임한다 — 네이티브는 SecureStore(키체인), 웹은 localStorage.
 */
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import { authStorage } from './storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 없습니다. .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정하세요 (.env.example 참고).',
  );
}

const options: SupabaseClientOptions<'public'> = {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // 모바일 딥링크 방식이 아니므로
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
