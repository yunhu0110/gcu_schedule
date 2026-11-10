/**
 * 회차 결과 — 해당 회차 탈락자 + 해당 회차까지 생존자 + 내 예측 2명의 생존 여부.
 * 데이터는 RLS로 '내 시청 범위 이하'만 반환되므로, 범위 밖 ep 접근 시 탈락자 없음으로 보인다.
 * 최종 우승자 정보는 여기서 노출하지 않는다. (09-DEVIL-RULES §6-3)
 */
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyPicks, listContestants, listVisibleEliminations } from '@/api/devil';

export default function ResultScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { ep } = useLocalSearchParams<{ ep?: string }>();
  const episode = Number(ep ?? 1);

  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });
  const { data: myPicks = [] } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId });

  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);

  const thisEpElims = elims.filter((e) => e.episode === episode);
  const eliminatedThrough = new Set(elims.filter((e) => e.episode <= episode).map((e) => e.contestant_id));

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>{episode}화 결과</Text>

      {/* 해당 회차 탈락자 */}
      <Text variant="bodyBold" color={colors.light.devilSub} style={styles.sectionLabel}>{episode}화 탈락자</Text>
      {thisEpElims.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text variant="bodySm" color={colors.light.devilSub}>등록된 탈락자가 없어요.</Text>
        </View>
      ) : (
        <View style={styles.elimList}>
          {thisEpElims.map((e) => (
            <View key={e.contestant_id} style={styles.elimRow}>
              <Image source={CONTESTANT_IMAGE[e.contestant_id]} style={styles.elimAvatar} />
              <Text variant="h2" color={colors.light.devilInk}>{nameOf[e.contestant_id] ?? '?'}</Text>
            </View>
          ))}
        </View>
      )}

      {/* 내 예측 2명의 이 회차 기준 생존 여부 */}
      {myPicks.length > 0 && (
        <>
          <Text variant="bodyBold" color={colors.light.devilSub} style={styles.sectionLabel}>내 예측 ({episode}화 기준)</Text>
          <View style={styles.myPicks}>
            {myPicks.map((id) => {
              const dead = eliminatedThrough.has(id);
              return (
                <View key={id} style={styles.pickCard}>
                  <Image source={CONTESTANT_IMAGE[id]} style={[styles.pickAvatar, dead && styles.dim]} />
                  <Text variant="bodySm" color={colors.light.devilInk}>{nameOf[id] ?? '?'}</Text>
                  <Text variant="caption" color={dead ? '#DC2626' : '#16A34A'}>{dead ? '탈락' : '생존'}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.confirm}>
        <Svg width={22} height={22} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="12" fill={colors.light.devilBlue} /><Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
        <Text variant="bodySm" color={colors.light.devilBlue} style={{ flex: 1 }}>{episode}화까지 생존 {contestants.length - eliminatedThrough.size}명 · 탈락 {eliminatedThrough.size}명</Text>
      </View>

      <Button label="확인" block onPress={() => router.back()} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginTop: space.xl, marginBottom: space.sm },
  emptyBox: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, alignItems: 'center' },
  elimList: { gap: space.sm },
  elimRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.md },
  elimAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.light.devilCellBg },
  myPicks: { flexDirection: 'row', gap: space.md },
  pickCard: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg },
  pickAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.light.hairline },
  dim: { opacity: 0.5 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, padding: space.lg, marginTop: space.xl },
  cta: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
});
