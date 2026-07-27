/**
 * 하단 탭 5개: 표지 · 달력 · 위키 · 정산 · 나.
 * 텍스트 중심 컨셉이라 아이콘 없이 라벨만. 활성 ink / 비활성 slate, 상단 헤어라인.
 */
import { Tabs } from 'expo-router';
import { colors } from '@/theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.ink,
        tabBarInactiveTintColor: colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.light.paper,
          borderTopColor: colors.light.hairline,
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIconStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '표지' }} />
      <Tabs.Screen name="calendar" options={{ title: '달력' }} />
      <Tabs.Screen name="wiki" options={{ title: '위키' }} />
      <Tabs.Screen name="settle" options={{ title: '정산' }} />
      <Tabs.Screen name="me" options={{ title: '나' }} />
    </Tabs>
  );
}
