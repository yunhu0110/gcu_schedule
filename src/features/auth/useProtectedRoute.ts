/**
 * 세션 게이팅 — 로그인 안 했으면 (auth)로, 했으면 (tabs)로 리다이렉트.
 * previewMode(개발용)면 세션 없이도 탭을 볼 수 있게 통과시킨다.
 */
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useDevStore } from '@/store/devStore';

export function useProtectedRoute(session: unknown, loading: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const preview = useDevStore((s) => s.previewMode);

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup && !preview) {
      router.replace('/sign-in');
    } else if (session && inAuthGroup) {
      router.replace('/calendar');
    }
  }, [session, loading, segments, preview, router]);
}
