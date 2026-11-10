/**
 * 전체 생존자 확인 — 내 시청 완료 범위까지의 '생존자'만 표시(RLS로 범위 밖 탈락은 안 옴).
 * 탈락자 정보는 꼭 필요한 '회차당 결과 확인'에서만 노출 → 여기선 탈락자 명단을 보이지 않는다(스포일러 최소화).
 * 최종 우승자와 혼동 방지: 현재 생존 상태만. (09-DEVIL-RULES §8)
 */
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyWatch, listContestants, listVisibleEliminations, watchThrough } from '@/api/devil';

export default function SurvivorsScreen() {
  const { userId } = useAuth();
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: watched = [] } = useQuery({ queryKey: ['devil', 'watch', userId], queryFn: () => getMyWatch(userId as string), enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });

  const through = watchThrough(watched);
  const eliminatedIds = useMemo(() => new Set(elims.map((e) => e.contestant_id)), [elims]);
  const survivors = contestants.filter((c) => !eliminatedIds.has(c.id));

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>전체 생존자 확인</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        {through > 0 ? `${through}화까지 시청 완료 기준 · 생존 ${survivors.length}명` : '아직 시청 완료한 회차가 없어요.'}
      </Text>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={[styles.dot, styles.dotGreen]} />
          <Text variant="bodyBold" color={colors.light.devilInk}>생존 중 ({survivors.length}명)</Text>
        </View>
        <View style={styles.grid}>
          {survivors.map((c) => (
            <View key={c.id} style={styles.cell}>
              <Image source={CONTESTANT_IMAGE[c.id]} style={styles.avatar} />
              <Text variant="caption" color={colors.light.devilInk} numberOfLines={1} style={styles.name}>{c.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <Text variant="caption" color={colors.light.devilSub} style={styles.note}>
        탈락자 명단은 '회차당 결과 확인'에서만 볼 수 있어요.{'\n'}
        현재 생존 중인 출연자가 최종 우승자를 의미하지는 않습니다.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  section: { marginTop: space.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotGreen: { backgroundColor: '#16A34A' },
  dotRed: { backgroundColor: '#DC2626' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', rowGap: space.lg },
  cell: { width: '25%', alignItems: 'center', paddingHorizontal: space.xs },
  cellElim: { opacity: 0.5 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.light.devilCellBg },
  name: { marginTop: space.xs, maxWidth: '100%' },
  note: { textAlign: 'center', marginTop: space.xl, lineHeight: 20 },
});
