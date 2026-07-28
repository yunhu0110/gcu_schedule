/**
 * 하단 탭 4개: 홈 · 달력 · 기록 · 마이페이지. 각 탭에 라인 아이콘 + 라벨.
 * 활성 ink / 비활성 slate, 상단 헤어라인. (정산은 이후 마일스톤 — 탭에서 숨김)
 */
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/theme/tokens';
import { TabIcon, type TabIconName } from '@/components/TabIcon';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 10); // 기기 홈 인디케이터/버튼과 겹치지 않게
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.light.ink,
        tabBarInactiveTintColor: colors.light.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.light.paper,
          borderTopWidth: 0, // 하단 탭 위 구분선 제거(화면마다 있던 눈금자 정리)
          height: 58 + bottom,
          paddingTop: 6,
          paddingBottom: bottom,
        },
        tabBarLabelStyle: { fontSize: 11, lineHeight: 14, fontFamily: fonts.bodyBold },
      }}
    >
      <Tabs.Screen name="index" options={{ title: '홈', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="calendar" options={{ title: '달력', tabBarIcon: icon('calendar') }} />
      <Tabs.Screen name="wiki" options={{ title: '기록', tabBarIcon: icon('record') }} />
      <Tabs.Screen name="me" options={{ title: '마이페이지', tabBarIcon: icon('profile') }} />
      {/* 정산: 이후 마일스톤 — 탭에서 숨김(라우트는 유지) */}
      <Tabs.Screen name="settle" options={{ href: null }} />
    </Tabs>
  );
}

function icon(name: TabIconName) {
  return ({ color }: { color: string }) => <TabIcon name={name} color={color} />;
}
