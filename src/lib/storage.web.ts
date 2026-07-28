/**
 * 키-값 저장소 (웹) — localStorage 기반. storage.ts의 웹 대응본.
 *
 * 아이폰 1명이 PWA(홈 화면에 추가)로 쓰기 위한 경로다. 06-DEPLOYMENT.md 참조.
 * 네이티브의 SecureStore(키체인)와 달리 localStorage는 같은 오리진의 JS에서 읽을 수 있다.
 * 여기 담기는 건 Supabase 세션(JWT)뿐이고, 이는 웹 앱의 통상적인 보관 방식이다.
 * 접근 권한은 어차피 DB의 RLS가 최종 판정하므로 저장 위치가 권한을 넓히지는 않는다.
 *
 * 청크 분할은 하지 않는다 — localStorage는 오리진당 ~5MB로 세션 크기에 여유가 크다.
 */
export type KeyValueStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * localStorage는 사파리 프라이빗 모드나 저장 공간 부족에서 throw 할 수 있다.
 * 저장 실패로 앱 전체가 죽는 것보다 "로그인이 유지되지 않는" 쪽이 낫다.
 */
function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

const webStorage: KeyValueStorage = {
  async getItem(key: string): Promise<string | null> {
    const ls = safeLocalStorage();
    if (!ls) return null;
    try {
      return ls.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    const ls = safeLocalStorage();
    if (!ls) return;
    try {
      ls.setItem(key, value);
    } catch {
      // 저장 실패는 무시 — 이번 세션 동안은 메모리로 동작한다.
    }
  },
  async removeItem(key: string): Promise<void> {
    const ls = safeLocalStorage();
    if (!ls) return;
    try {
      ls.removeItem(key);
    } catch {
      // 무시
    }
  },
};

export const authStorage = webStorage;
export const prefStorage = webStorage;
