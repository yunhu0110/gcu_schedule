/**
 * devStore — 개발용 임시 상태.
 * previewMode: 백엔드(Supabase) 적용 전 로그인 없이 탭 화면을 둘러보기 위한 임시 우회.
 * ⚠️ 백엔드/인증이 실사용되면 이 우회는 제거한다. (M0-4 이후 정리)
 */
import { create } from 'zustand';

type DevState = {
  previewMode: boolean;
  setPreview: (v: boolean) => void;
};

export const useDevStore = create<DevState>((set) => ({
  previewMode: false, // 실사용: 로그인 필요(데블스 플랜 등 서버 기능은 세션/RLS 기준으로 동작).
  setPreview: (v) => set({ previewMode: v }),
}));
