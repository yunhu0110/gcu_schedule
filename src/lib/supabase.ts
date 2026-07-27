/**
 * Supabase 클라이언트 — 앱의 유일한 백엔드 진입점.
 * 컴포넌트에서 supabase.from()을 직접 부르지 않는다. src/api/*.ts 쿼리 함수를 통해서만 접근.
 *
 * 키: anon/publishable(공개) 키만 사용한다. service_role / sb_secret_ 키는 절대 클라이언트에 넣지 않는다.
 * 세션은 expo-secure-store(기기 키체인)에 보관한다. SecureStore의 2KB 값 제한을 피하려고 청크 어댑터를 쓴다.
 */
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClientOptions } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase 환경변수가 없습니다. .env에 EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY를 설정하세요 (.env.example 참고).',
  );
}

/**
 * 청크 SecureStore 어댑터.
 * SecureStore는 값 1개당 ~2KB 제한이 있는데 Supabase 세션(JWT)이 이를 넘길 수 있다.
 * 값을 2000바이트 단위로 쪼개 여러 키에 저장하고, 인덱스 키에 청크 수를 기록한다.
 */
const CHUNK_SIZE = 2000;

const LargeSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(key);
    if (countRaw == null) return null;
    const count = Number(countRaw);
    if (!Number.isInteger(count) || count < 0) {
      // 예전 단일 저장분 호환: 숫자가 아니면 값 그 자체로 본다.
      return countRaw;
    }
    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null; // 손상 → 없음 처리
      value += part;
    }
    return value;
  },
  async setItem(key: string, value: string): Promise<void> {
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    // 이전 청크 정리 후 새로 기록
    await LargeSecureStore.removeItem(key);
    await SecureStore.setItemAsync(key, String(chunks.length));
    for (let i = 0; i < chunks.length; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, chunks[i]);
    }
  },
  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(key);
    await SecureStore.deleteItemAsync(key);
    const count = Number(countRaw);
    if (Number.isInteger(count) && count > 0) {
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}.${i}`);
      }
    }
  },
};

const options: SupabaseClientOptions<'public'> = {
  auth: {
    storage: LargeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // 모바일 딥링크 방식이 아니므로
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, options);
