/**
 * S1. 표지/홈 — "Wanted Sans 하이에너지" 시안 반영 (design/ 핸드오프 기준).
 * 콜드 스타트 시 3초 안에 "다음 모임 → 참석/불참, 이번 달 일정 입력, 최근 문서"를 보여준다.
 * 지금은 데이터 연결 전 플레이스홀더(고정값). 실제 데이터(hosts/meetups/availabilities)는 M1.
 */
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, fonts, radius, space } from '@/theme/tokens';

// --- 플레이스홀더 데이터 (M1에서 서버 연결) ---
const NEXT = { dday: 19, when: '08.15 SAT · 18:00', place: '성심당 본점', area: '대전 중구', budget: '₩25,000' };
const SCHEDULE = { entered: 4, total: 6, deadlineD: 3 };
const RECENT = [
  { title: '7월 모임 기록', ago: '어제' },
  { title: '가고 싶은 곳 후보', ago: '3일 전' },
];

const LOGO_COLORS = ['#004E96', '#80C341', '#00B9F2', '#FCAF16'];

export default function HomeScreen() {
  return (
    <Screen scroll>
      {/* 브랜드 헤더 */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <View style={styles.mark}>
            {LOGO_COLORS.map((c) => (
              <View key={c} style={[styles.markBar, { backgroundColor: c }]} />
            ))}
          </View>
          <Text variant="brand">월간gcu</Text>
        </View>
        <Text variant="kicker" color={colors.light.textSecondary}>
          2026.08 · No.8
        </Text>
      </View>

      {/* 히어로 D-day 카드 */}
      <View style={styles.hero}>
        <View style={styles.heroDeco} />
        <View style={styles.heroTop}>
          <View style={styles.chip}>
            <Text variant="kicker" color={colors.light.paper}>
              ◆ 다음 모임
            </Text>
          </View>
          <Text variant="mono" color={colors.light.paper60}>
            {NEXT.when}
          </Text>
        </View>

        <Text style={styles.dday}>D-{NEXT.dday}</Text>

        <View style={styles.heroDivider}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" color={colors.light.paper} style={{ fontSize: 15 }}>
              {NEXT.place}
            </Text>
            <Text variant="caption" color={colors.light.paper60}>
              {NEXT.area}
            </Text>
          </View>
          <Text variant="mono" color={colors.light.moneyOnDark} style={{ fontSize: 14 }}>
            {NEXT.budget}
          </Text>
        </View>
      </View>

      {/* 참석 / 불참 */}
      <View style={styles.actionRow}>
        <Button label="참석할게요" style={{ flex: 2 }} />
        <Button label="불참" variant="secondary" style={{ flex: 1 }} />
      </View>

      {/* 이번 달 일정 입력 */}
      <View style={styles.softCard}>
        <View style={styles.softTop}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>
            8월 일정, 아직이에요
          </Text>
          <View style={styles.deadlinePill}>
            <Text style={styles.deadlineText}>마감 D-{SCHEDULE.deadlineD}</Text>
          </View>
        </View>

        <View style={styles.avatarBlock}>
          <View style={styles.avstack}>
            {Array.from({ length: SCHEDULE.total }).map((_, i) => {
              const dim = i >= SCHEDULE.entered;
              return (
                <View key={i} style={[styles.ava, i > 0 && styles.avaOverlap, dim && styles.avaDim]}>
                  <Text variant="caption" color={colors.light.textSecondary}>
                    {String.fromCharCode(65 + i)}
                  </Text>
                </View>
              );
            })}
          </View>
          <Text variant="caption" color={colors.light.textSecondary}>
            {SCHEDULE.entered} / {SCHEDULE.total} 입력
          </Text>
        </View>

        <Button label="내 일정 입력하기" block style={{ marginTop: space.lg }} />
      </View>

      {/* 최근 문서 */}
      <View style={styles.recent}>
        <Text variant="kicker" color={colors.light.textSecondary}>
          Recent
        </Text>
        {RECENT.map((r) => (
          <View key={r.title} style={styles.recentRow}>
            <View style={styles.recentDot} />
            <Text variant="bodySm" style={{ flex: 1 }}>
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
  mark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 20 },
  markBar: { width: 4, height: 16, borderRadius: 2 },

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
  dday: {
    fontFamily: fonts.ddayNumber,
    fontSize: 84,
    lineHeight: 84 * 0.86,
    letterSpacing: -1,
    color: colors.light.paper,
    marginTop: space.md,
    transform: [{ skewX: '-8deg' }],
  },
  heroDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.light.paper16,
    paddingTop: space.lg,
    marginTop: space.md,
    gap: space.md,
  },

  actionRow: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },

  softCard: {
    backgroundColor: colors.light.surfacePlate,
    borderRadius: radius.soft,
    padding: 18,
    marginTop: space.xl,
  },
  softTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deadlinePill: {
    backgroundColor: colors.light.amber,
    borderRadius: radius.pill,
    height: 26,
    paddingHorizontal: 11,
    justifyContent: 'center',
  },
  deadlineText: { fontFamily: fonts.monoSemibold, fontSize: 13, letterSpacing: 1, color: colors.light.ink },

  avatarBlock: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg },
  avstack: { flexDirection: 'row' },
  ava: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.light.mist,
    borderWidth: 2,
    borderColor: colors.light.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avaOverlap: { marginLeft: -8 },
  avaDim: { opacity: 0.42 },

  recent: { marginTop: space.xl, gap: space.xs },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  recentDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.light.cobalt },
});
