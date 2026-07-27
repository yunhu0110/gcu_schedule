/**
 * TanStack Query 클라이언트 — 서버 상태 단일 관리.
 * 6인 앱이라 공격적인 리페치는 불필요. 화면 재진입 시 stale 데이터는 백그라운드 갱신.
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30초 동안은 fresh로 취급
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
