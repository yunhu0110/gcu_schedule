/**
 * S1. 표지/홈 — 브랜드 표지 + 다음 모임 상태 + 이번 달 일정 입력 유도.
 * 다음 모임은 아직 데이터(meetups)가 없으므로 "미정"으로 두고, 현재일 기준 다음 달을 조율 대상으로 안내한다.
 * 모든 CTA는 실제로 동작한다(달력/위키로 이동). 실제 모임/참석 데이터 연결은 M1.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { addMonths, todayStr, volLabel } from '@/lib/date';

const RECENT = [
  { title: '7월 모임 기록', ago: '어제' },
  { title: '가고 싶은 곳 후보', ago: '3일 전' },
];

export default function HomeScreen() {
  const router = useRouter();
  const today = todayStr();
  const nextMonth = addMonths(today, 1);
  const nextMonthNum = Number(nextMonth.slice(5, 7)); // 다음 달(월)

  return (
    <Screen scroll>
      {/* 브랜드 헤더 */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <Logo height={22} />
          <Text variant="brand">월간gcu</Text>
        </View>
        <Text variant="kicker" color={colors.light.textSecondary}>
          {volLabel(today)}
        </Text>
      </View>

      {/* 히어로 — 다음 모임 미정 */}
      <View style={styles.hero}>
        <View style={styles.heroDeco} />
        <View style={styles.heroTop}>
          <View style={styles.chip}>
            <Text variant="kicker" color={colors.light.paper}>
              ◆ 다음 모임
            </Text>
          </View>
          <Text variant="mono" color={colors.light.paper60}>
            {volLabel(nextMonth)}
          </Text>
        </View>

        <Text style={styles.heroBig}>미정</Text>

        <Text variant="body" color={colors.light.paper} style={{ marginTop: space.xs }}>
          {nextMonthNum}월 모임 일정을 모으는 중이에요.
        </Text>
        <Text variant="bodySm" color={colors.light.paper60} style={{ marginTop: space.xs }}>
          달력에서 각자 가능한 날을 입력하면 후보가 잡혀요.
        </Text>

        <Button
          label="달력에서 내 일정 입력"
          block
          onPress={() => router.push('/calendar')}
          style={{ marginTop: space.lg }}
        />
      </View>

      {/* 이번 달 일정 입력 */}
      <View style={styles.softCard}>
        <View style={styles.softTop}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>
            {nextMonthNum}월 일정, 아직이에요
          </Text>
        </View>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          가능/불가/미정을 날짜별로 남겨두면 6명 게이지가 채워져요.
        </Text>
        <Button
          label="내 일정 입력하기"
          block
          onPress={() => router.push('/calendar')}
          style={{ marginTop: space.lg }}
        />
      </View>

      {/* 최근 문서 */}
      <View style={styles.recent}>
        <Text variant="kicker" color={colors.light.textSecondary}>
          Recent
        </Text>
        {RECENT.map((r) => (
          <View key={r.title} style={styles.recentRow}>
            <View style={styles.recentDot} />
            <Text variant="bodySm" style={{ flex: 1 }} onPress={() => router.push('/wiki')}>
              {r.title}
            </Text>
            <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 10 }}>
              {r.ago}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.lg },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  hero: {
    backgroundColor: colors.light.heroBg,
    borderRadius: radius.hero,
    padding: 22,
    overflow: 'hidden',
  },
  heroDeco: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.light.cobalt22,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    backgroundColor: colors.light.cobalt,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  heroBig: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 66,
    letterSpacing: -1,
    color: colors.light.paper,
    marginTop: space.md,
  },

  softCard: {
    backgroundColor: colors.light.surfacePlate,
    borderRadius: radius.soft,
    padding: 18,
    marginTop: space.xl,
  },
  softTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  recent: { marginTop: space.xl, gap: space.xs },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  recentDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.light.cobalt },
});
