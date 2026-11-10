/**
 * 데블스 플랜 상세/메인 — stitch_devil/_7 레퍼런스 + 8-기능 메뉴.
 * 배너(제목 박힌 이미지) + 뒤로/공유/진행중 배지 → 흰 영역에 제목/설명/기간/규칙 + 참여하기.
 * 하단 메뉴 그리드: 나의 예측·회차 시청 관리·스포일러 결과·생존 현황·전체 생존자·참여자 예측·최종 결과·벌칙 안내.
 * ⚠️ 프론트 전용.
 */
import { useState } from 'react';
import { ImageBackground, LayoutAnimation, Platform, Pressable, StyleSheet, UIManager, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { TabIcon } from '@/components/TabIcon';
import { colors, radius, space } from '@/theme/tokens';
import { DEVIL_BANNER, DEVIL_META } from '@/features/event/devilAssets';

function ShareIcon({ color }: { color: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3v12M12 3l-4 4M12 3l4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const RULES: string[] = [
  '최종 우승 예상 출연자 2명을 선택합니다.',
  '미선택 출연자는 FA 시장에서 영입 및 교체할 수 있습니다.',
  '탈락한 출연자는 FA 시장에서 영입할 수 없습니다.',
  '트레이드 시 기존 픽은 FA로 이동하고 신규 픽이 등록됩니다.',
  "시청 기록은 회차 선택 후 '시청 완료 등록하기'를 눌러야 저장됩니다.",
  '회차 결과는 본인의 연속 시청 완료 범위까지만 공개됩니다.',
  '최종 결과는 전체 시청 완료 또는 별도 스포일러 동의 후 공개됩니다.',
  '다른 참여자의 예측은 확인할 수 있지만, 결과는 본인의 시청 범위까지만 공개됩니다.',
  '[1위] 본인의 픽에 최종 우승자가 있으면, 본인을 제외한 5명이 그 사람에게 1만원 이상 상품을 제공합니다.',
  '[꼴찌] 본인의 픽 2명이 가장 먼저 모두 탈락하면, 본인을 제외한 5명에게 편지 한 장씩 씁니다. (탈락 기준: 발표 시 성우의 호명 순서)',
];

type MenuItem = {
  label: string;
  emoji: string;
  iconBg: string;
  route: string;
};

const MENU: MenuItem[] = [
  { label: '나의 예측',         emoji: '🎯', iconBg: colors.light.devilBlueWash, route: '/event/prediction' },
  { label: '회차 시청 관리',    emoji: '📺', iconBg: colors.light.devilBlueWash, route: '/event/episodes' },
  { label: '회차당\n결과 확인',  emoji: '🔍', iconBg: colors.light.devilBlueWash, route: '/event/spoiler-results' },
  { label: '나의 예측\n생존 현황', emoji: '💫', iconBg: colors.light.devilBlueWash, route: '/event/my-survival' },
  { label: '참여자 예측\n현황',  emoji: '📊', iconBg: colors.light.devilBlueWash, route: '/event/all-predictions' },
  { label: '최종 결과',         emoji: '🏆', iconBg: '#FEF3C7', route: '/event/winner' },
  { label: '벌칙 안내',         emoji: '🚨', iconBg: '#FEE2E2', route: '/event/penalty' },
];

export default function DevilsPlanMain() {
  const router = useRouter();
  const [rulesOpen, setRulesOpen] = useState(false);

  function toggleRules() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setRulesOpen((v) => !v);
  }

  return (
    <Screen scroll padded={false} edges={['top', 'bottom']}>
      {/* 상단바 — 배너 위. 뒤로/공유가 배너와 겹치지 않게 분리. */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.topBtn}>
          <Text variant="h2" color={colors.light.devilInk}>‹</Text>
        </Pressable>
        <Pressable hitSlop={12} style={styles.topBtn}>
          <ShareIcon color={colors.light.devilInk} />
        </Pressable>
      </View>

      {/* 배너 — 제목 박힌 이미지 */}
      <ImageBackground source={DEVIL_BANNER} style={styles.banner} imageStyle={styles.bannerImg} />

      <View style={styles.pad}>
        <Text variant="h1" color={colors.light.devilInk}>{DEVIL_META.title}</Text>
        <Text variant="body" color={colors.light.devilSub} style={styles.tagline}>{DEVIL_META.tagline}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaIcon}><TabIcon name="calendar" color={colors.light.devilBlue} size={18} /></View>
          <Text variant="bodySm" color={colors.light.devilSub}>{DEVIL_META.period}</Text>
        </View>

        {/* 단체관람 포인트 배너 */}
        <View style={styles.watchBanner}>
          <Text style={styles.watchEmoji}>🎬</Text>
          <View style={{ flex: 1 }}>
            <Text variant="caption" color={colors.light.paper} style={styles.watchKicker}>단체관람</Text>
            <Text variant="bodyBold" color={colors.light.paper} style={styles.watchTitle}>11월 27일 (금) 마지막화 단체관람</Text>
          </View>
        </View>

        {/* 규칙 — 접기/펼치기 아코디언 */}
        <View style={styles.ruleCard}>
          <Pressable onPress={toggleRules} style={({ pressed }) => [styles.ruleHeader, pressed && styles.pressed]}>
            <View style={styles.ruleIcon}><Text style={styles.ruleEmoji}>📋</Text></View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyBold" color={colors.light.devilInk}>규칙</Text>
              <Text variant="bodySm" color={colors.light.devilSub} style={{ marginTop: 2 }}>
                {rulesOpen ? '규칙을 눌러 접기' : '눌러서 전체 규칙 보기'}
              </Text>
            </View>
            <Svg width={22} height={22} viewBox="0 0 24 24" style={rulesOpen ? styles.chevUp : undefined}>
              <Path d="M7 10l5 5 5-5" stroke={colors.light.devilSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </Pressable>

          {rulesOpen && (
            <View style={styles.ruleList}>
              {RULES.map((rule, i) => (
                <View key={i} style={styles.ruleItem}>
                  <View style={styles.ruleNum}>
                    <Text variant="caption" color={colors.light.devilBlue} style={styles.ruleNumText}>{i + 1}</Text>
                  </View>
                  <Text variant="bodySm" color={colors.light.devilInk} style={styles.ruleItemText}>{rule}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 기능 메뉴 */}
        <Text variant="bodyBold" color={colors.light.devilSub} style={styles.menuHeader}>기능</Text>
        <View style={styles.menuGrid}>
          {MENU.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.menuCell, pressed && styles.pressed]}
              onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.iconBg }]}>
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
              </View>
              <Text variant="caption" color={colors.light.devilInk} style={styles.menuLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.screen, height: 44 },
  topBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  banner: { aspectRatio: 16 / 10, marginHorizontal: space.screen, borderRadius: radius.hero, overflow: 'hidden' },
  bannerImg: { borderRadius: radius.hero },
  pad: { paddingHorizontal: space.screen, paddingTop: space.xl },
  tagline: { marginTop: space.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xl },
  metaIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.light.devilBlueWash, alignItems: 'center', justifyContent: 'center' },
  watchBanner: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.devilBlue, borderRadius: radius.soft, paddingHorizontal: space.lg, paddingVertical: space.md, marginTop: space.xl },
  watchEmoji: { fontSize: 24, lineHeight: 30 },
  watchKicker: { fontSize: 11, lineHeight: 15, opacity: 0.85, letterSpacing: 1 },
  watchTitle: { fontSize: 15, marginTop: 1 },
  ruleCard: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginTop: space.md },
  ruleHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { opacity: 0.92 },
  ruleIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.light.devilBlueWash, alignItems: 'center', justifyContent: 'center' },
  ruleEmoji: { fontSize: 22, lineHeight: 28 },
  chevUp: { transform: [{ rotate: '180deg' }] },
  ruleList: { marginTop: space.lg, gap: space.md },
  ruleItem: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  ruleNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.light.devilBlueWash, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  ruleNumText: { fontSize: 12, fontWeight: '700' },
  ruleItemText: { flex: 1, lineHeight: 21 },
  cta: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  menuHeader: { marginTop: space.section, marginBottom: space.md, fontSize: 12, letterSpacing: 0.5 },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.xl },
  menuCell: { width: '48%', backgroundColor: colors.light.devilCellBg, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  menuIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  menuEmoji: { fontSize: 20, lineHeight: 24 },
  menuLabel: { fontSize: 12, lineHeight: 17 },
});
