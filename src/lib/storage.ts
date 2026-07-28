/**
 * 키-값 저장소 (네이티브) — expo-secure-store 기반.
 *
 * 웹에서는 SecureStore가 동작하지 않으므로 storage.web.ts가 대신 로드된다(Metro 플랫폼 확장자 해석).
 * 두 파일은 반드시 같은 인터페이스를 export 한다.
 *   - authStorage : Supabase 세션 보관용 (값이 커서 청크 분할)
 *   - prefStorage : 저장된 아이디 같은 소소한 설정값
 */
import * as SecureStore from 'expo-secure-store';

export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * 청크 SecureStore 어댑터.
 * SecureStore는 값 1개당 ~2KB 제한이 있는데 Supabase 세션(JWT)이 이를 넘길 수 있다.
 * 값을 2000바이트 단위로 쪼개 여러 키에 저장하고, 인덱스 키에 청크 수를 기록한다.
 */
const CHUNK_SIZE = 2000;

export const authStorage: KeyValueStorage = {
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
    await authStorage.removeItem(key);
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

export const prefStorage: KeyValueStorage = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};
