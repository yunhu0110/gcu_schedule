/**
 * 루트 레이아웃 — 폰트 프리로드(스플래시 게이팅) + 전역 프로바이더 + 세션 게이팅 + 최상위 Stack.
 */
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { queryClient } from '@/lib/queryClient';
import { fontMap } from '@/theme/fonts';
import { colors } from '@/theme/tokens';
import { AuthProvider, useAuth } from '@/features/auth/AuthContext';
import { useProtectedRoute } from '@/features/auth/useProtectedRoute';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { session, loading } = useAuth();
  useProtectedRoute(session, loading);

  if (loading) return null; // 세션 확인 중엔 스플래시 유지

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.light.bg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="post/[id]" />
      <Stack.Screen name="feedback" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
