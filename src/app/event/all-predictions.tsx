/**
 * 참여자 예측 현황 — 모든 참여자의 픽 2명(누가 누구를 뽑았는지).
 * 스포일러 최소화: 여기선 생존/탈락을 표시하지 않는다(탈락 정보는 '회차당 결과 확인'에서만).
 * 예측 성공·실패는 최종 결과 공개 전 표시 금지. (09-DEVIL-RULES §9)
 */
import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { DetailHeader } from '@/components/DetailHeader';
import { AnimatedHeading } from '@/components/AnimatedHeading';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { listContestants, listPredictions } from '@/api/devil';

export default function AllPredictionsScreen() {
  const { userId } = useAuth();
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: preds = [] } = useQuery({ queryKey: ['devil', 'predictions'], queryFn: listPredictions, enabled: !!userId });

  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);

  // member_id → { nickname, picks[] }
  const byMember = useMemo(() => {
    const m = new Map<string, { nickname: string; picks: number[] }>();
    for (const p of preds) {
      const cur = m.get(p.member_id) ?? { nickname: p.nickname, picks: [] };
      cur.picks.push(p.contestant_id);
      m.set(p.member_id, cur);
    }
    return [...m.entries()];
  }, [preds]);

  return (
    <Screen scroll>
      <DetailHeader />
      <AnimatedHeading title="참여자 예측 현황" subtitle="각 참여자가 선택한 출연자 2명이에요." color={colors.light.devilInk} subColor={colors.light.devilSub} subStyle={styles.sub} />

      {byMember.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text variant="bodySm" color={colors.light.devilSub}>아직 예측을 등록한 참여자가 없어요.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {byMember.map(([mid, info]) => (
            <View key={mid} style={styles.card}>
              <Text variant="bodyBold" color={mid === userId ? colors.light.devilBlue : colors.light.devilInk} style={styles.pName}>
                {mid === userId ? `${info.nickname} (나)` : info.nickname}
              </Text>
              <View style={styles.picks}>
                {info.picks.map((cId) => (
                  <View key={cId} style={styles.pick}>
                    <Image source={CONTESTANT_IMAGE[cId]} style={styles.avatar} />
                    <Text variant="caption" color={colors.light.devilInk} numberOfLines={1} style={styles.pickName}>{nameOf[cId] ?? '?'}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      <Text variant="caption" color={colors.light.devilSub} style={styles.note}>
        생존/탈락은 '회차당 결과 확인'에서, 예측 성공·실패는 최종 결과 공개 후 확인할 수 있어요.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  emptyBox: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.xl, alignItems: 'center', marginTop: space.xl },
  list: { gap: space.md, marginTop: space.xl },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, gap: space.lg },
  pName: { flex: 1 },
  picks: { flexDirection: 'row', gap: space.md },
  pick: { alignItems: 'center', width: 56 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.light.hairline },
  pickName: { marginTop: space.xs, maxWidth: 56 },
  note: { textAlign: 'center', marginTop: space.xl },
});
