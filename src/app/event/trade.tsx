/**
 * 트레이드 — 내 픽 1명을 FA 출연자와 교체(devil_trade RPC, 서버 트랜잭션).
 * FA = 아무에게도 배정 안 된 출연자 − 탈락자. 중복 배정은 서버에서 방지. (09-DEVIL-RULES §3)
 */
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { AnimatedHeading } from '@/components/AnimatedHeading';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyPicks, listContestants, listPredictions, listTradeOffers, listVisibleEliminations, trade } from '@/api/devil';

export default function TradeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [myOut, setMyOut] = useState<number | null>(null);
  const [faIn, setFaIn] = useState<number | null>(null);

  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: myPicks = [] } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId });
  const { data: preds = [] } = useQuery({ queryKey: ['devil', 'predictions'], queryFn: listPredictions, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });
  const { data: offers = [] } = useQuery({ queryKey: ['devil', 'offers'], queryFn: listTradeOffers, enabled: !!userId });

  const incomingCount = offers.filter((o) => o.status === 'pending' && o.target_id === userId).length;
  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);
  const takenIds = useMemo(() => new Set(preds.map((p) => p.contestant_id)), [preds]);
  const eliminatedIds = useMemo(() => new Set(elims.map((e) => e.contestant_id)), [elims]);
  // FA = 전체 − 배정됨 − (내 시청범위 내) 탈락자
  const availableFa = contestants.filter((c) => !takenIds.has(c.id) && !eliminatedIds.has(c.id));

  const tradeMut = useMutation({
    mutationFn: () => trade(myOut as number, faIn as number),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devil', 'myPicks'] });
      qc.invalidateQueries({ queryKey: ['devil', 'predictions'] });
      setMyOut(null); setFaIn(null);
      Alert.alert('트레이드 완료', '트레이드가 완료되었습니다.');
    },
    onError: (e) => Alert.alert('트레이드 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function confirmTrade() {
    if (myOut === null || faIn === null) return;
    Alert.alert('트레이드 확인', `${nameOf[myOut]} → ${nameOf[faIn]}\n정말 교체하시겠습니까?`, [
      { text: '취소', style: 'cancel' },
      { text: '트레이드', onPress: () => tradeMut.mutate() },
    ]);
  }

  const canTrade = myOut !== null && faIn !== null;

  return (
    <Screen scroll>
      <DetailHeader />
      <AnimatedHeading title="트레이드" subtitle="FA 영입, 또는 상대 선수와 교환 신청을 할 수 있어요." color={colors.light.devilInk} subColor={colors.light.devilSub} subStyle={styles.sub} />

      {/* 상대와의 트레이드 진입 */}
      <View style={styles.p2pRow}>
        <Pressable onPress={() => router.push('/event/trade-propose')} style={({ pressed }) => [styles.p2pBtn, pressed && styles.pressed]}>
          <Text style={styles.p2pEmoji}>🤝</Text>
          <Text variant="bodySm" color={colors.light.devilInk} style={styles.p2pLabel}>상대와 트레이드 신청</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/event/trade-offers')} style={({ pressed }) => [styles.p2pBtn, pressed && styles.pressed]}>
          <Text style={styles.p2pEmoji}>📨</Text>
          <Text variant="bodySm" color={colors.light.devilInk} style={styles.p2pLabel}>트레이드 신청함</Text>
          {incomingCount > 0 && <View style={styles.badge}><Text variant="caption" color={colors.light.paper} style={styles.badgeText}>{incomingCount}</Text></View>}
        </Pressable>
      </View>

      <Text variant="bodyBold" color={colors.light.devilSub} style={styles.faHeader}>FA 영입</Text>

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>내 현재 픽</Text>
      {myPicks.length === 0 ? (
        <View style={styles.emptyFa}><Text variant="bodySm" color={colors.light.devilSub}>먼저 나의 예측에서 2명을 선택해주세요.</Text></View>
      ) : (
        <View style={styles.myGrid}>
          {myPicks.map((id) => {
            const selected = myOut === id;
            return (
              <Pressable key={id} style={[styles.bigCell, selected && styles.bigCellOut]} onPress={() => setMyOut(selected ? null : id)}>
                <Image source={CONTESTANT_IMAGE[id]} style={styles.bigAvatar} />
                <Text variant="caption" color={selected ? colors.light.devilAmber : colors.light.devilInk} style={styles.bigName}>{nameOf[id]}</Text>
                {selected && <Text variant="caption" color={colors.light.devilAmber} style={styles.bigTag}>교체 예정</Text>}
              </Pressable>
            );
          })}
        </View>
      )}

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>FA 시장 ({availableFa.length}명)</Text>
      {availableFa.length === 0 ? (
        <View style={styles.emptyFa}><Text variant="bodySm" color={colors.light.devilSub}>현재 영입 가능한 FA 출연자가 없어요.</Text></View>
      ) : (
        <View style={styles.faGrid}>
          {availableFa.map((c) => {
            const selected = faIn === c.id;
            return (
              <Pressable key={c.id} style={styles.faCell} onPress={() => setFaIn(selected ? null : c.id)}>
                <View style={[styles.faAvatarWrap, selected && styles.faAvatarOn]}>
                  <Image source={CONTESTANT_IMAGE[c.id]} style={styles.faAvatar} />
                </View>
                <Text variant="caption" color={selected ? colors.light.devilBlue : colors.light.devilSub} numberOfLines={1} style={styles.faName}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {canTrade && (
        <View style={styles.preview}>
          <Text variant="bodySm" color={colors.light.devilInk}>{nameOf[myOut!]} <Text color={colors.light.devilSub}>→</Text> {nameOf[faIn!]}</Text>
        </View>
      )}

      <Button label="트레이드 확인" block disabled={!canTrade} loading={tradeMut.isPending} onPress={confirmTrade} style={styles.cta} />
      <Button label="취소" variant="secondary" block onPress={() => router.back()} style={styles.cancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  pressed: { opacity: 0.9 },
  p2pRow: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  p2pBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, paddingVertical: space.lg },
  p2pEmoji: { fontSize: 18, lineHeight: 22 },
  p2pLabel: { fontSize: 12 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#DC2626', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeText: { fontSize: 11, lineHeight: 14 },
  faHeader: { marginTop: space.xl, fontSize: 12, letterSpacing: 0.5 },
  label: { marginTop: space.xl, marginBottom: space.md },
  myGrid: { flexDirection: 'row', gap: space.md },
  bigCell: { flex: 1, alignItems: 'center', backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, borderWidth: 2, borderColor: 'transparent' },
  bigCellOut: { borderColor: colors.light.devilAmber, backgroundColor: '#FEF3C7' },
  bigAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.light.hairline },
  bigName: { marginTop: space.sm },
  bigTag: { marginTop: 2, fontSize: 10 },
  faGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  faCell: { width: '22%', alignItems: 'center' },
  faAvatarWrap: { width: '100%', aspectRatio: 1, borderRadius: 999, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden', backgroundColor: colors.light.devilCellBg },
  faAvatarOn: { borderColor: colors.light.devilBlue },
  faAvatar: { width: '100%', height: '100%' },
  faName: { marginTop: space.sm, maxWidth: '100%' },
  emptyFa: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.xl, alignItems: 'center' },
  preview: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, padding: space.lg, marginTop: space.xl },
  cta: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  cancel: { marginTop: space.sm, borderRadius: radius.pill },
});
