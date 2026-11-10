/**
 * 트레이드 신청함 — 받은 신청(수락/거절)과 보낸 신청(취소).
 * 수락 시 서버 트랜잭션(devil_accept_trade)으로 양쪽 픽이 교환된다. (사용자 요청)
 */
import { useMemo } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { acceptTradeOffer, cancelTradeOffer, listContestants, listTradeOffers, rejectTradeOffer, type TradeOffer } from '@/api/devil';

const STATUS_LABEL: Record<TradeOffer['status'], string> = {
  pending: '대기중', accepted: '성사됨', rejected: '거절됨', canceled: '취소됨',
};

export default function TradeOffersScreen() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { data: offers = [] } = useQuery({ queryKey: ['devil', 'offers'], queryFn: listTradeOffers, enabled: !!userId });
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);

  function refresh() {
    qc.invalidateQueries({ queryKey: ['devil', 'offers'] });
    qc.invalidateQueries({ queryKey: ['devil', 'myPicks'] });
    qc.invalidateQueries({ queryKey: ['devil', 'predictions'] });
  }

  const acceptMut = useMutation({ mutationFn: acceptTradeOffer, onSuccess: () => { refresh(); Alert.alert('교환 완료', '트레이드가 성사되었습니다.'); }, onError: (e) => Alert.alert('수락 실패', e instanceof Error ? e.message : '다시 시도해주세요.') });
  const rejectMut = useMutation({ mutationFn: rejectTradeOffer, onSuccess: refresh, onError: (e) => Alert.alert('거절 실패', e instanceof Error ? e.message : '다시 시도해주세요.') });
  const cancelMut = useMutation({ mutationFn: cancelTradeOffer, onSuccess: refresh, onError: (e) => Alert.alert('취소 실패', e instanceof Error ? e.message : '다시 시도해주세요.') });

  const incoming = offers.filter((o) => o.target_id === userId);
  const outgoing = offers.filter((o) => o.proposer_id === userId);

  function Avatar({ id }: { id: number }) {
    return (
      <View style={styles.pair}>
        <Image source={CONTESTANT_IMAGE[id]} style={styles.avatar} />
        <Text variant="caption" color={colors.light.devilInk} numberOfLines={1} style={styles.pairName}>{nameOf[id]}</Text>
      </View>
    );
  }

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>트레이드 신청함</Text>

      {/* 받은 신청 */}
      <Text variant="bodyBold" color={colors.light.devilSub} style={styles.section}>받은 신청 ({incoming.filter((o) => o.status === 'pending').length})</Text>
      {incoming.length === 0 ? (
        <View style={styles.emptyBox}><Text variant="bodySm" color={colors.light.devilSub}>받은 신청이 없어요.</Text></View>
      ) : incoming.map((o) => (
        <View key={o.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text variant="bodySm" color={colors.light.devilInk}><Text variant="bodyBold">{o.proposer_nick}</Text> 님의 신청</Text>
            <Text variant="caption" color={o.status === 'pending' ? colors.light.devilBlue : colors.light.devilSub}>{STATUS_LABEL[o.status]}</Text>
          </View>
          {/* 받는 사람 관점: 내가 주는 건 request(상대가 원하는 내 선수), 내가 받는 건 offer */}
          <View style={styles.swapRow}>
            <View style={styles.side}><Text variant="caption" color={colors.light.devilSub}>내가 받음</Text><Avatar id={o.offer_contestant_id} /></View>
            <Text variant="h2" color={colors.light.devilSub}>↔</Text>
            <View style={styles.side}><Text variant="caption" color={colors.light.devilSub}>내가 줌</Text><Avatar id={o.request_contestant_id} /></View>
          </View>
          {o.cash > 0 && (
            <View style={styles.cashChip}><Text variant="bodySm" color="#16A34A">💵 현금 {o.cash.toLocaleString()}원 받음 (상대가 송금)</Text></View>
          )}
          {o.status === 'pending' && (
            <View style={styles.actions}>
              <Button label="거절" variant="secondary" onPress={() => rejectMut.mutate(o.id)} style={styles.rejectBtn} />
              <Button label="수락" loading={acceptMut.isPending} onPress={() => acceptMut.mutate(o.id)} style={styles.acceptBtn} />
            </View>
          )}
        </View>
      ))}

      {/* 보낸 신청 */}
      <Text variant="bodyBold" color={colors.light.devilSub} style={styles.section}>보낸 신청 ({outgoing.filter((o) => o.status === 'pending').length})</Text>
      {outgoing.length === 0 ? (
        <View style={styles.emptyBox}><Text variant="bodySm" color={colors.light.devilSub}>보낸 신청이 없어요.</Text></View>
      ) : outgoing.map((o) => (
        <View key={o.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text variant="bodySm" color={colors.light.devilInk}><Text variant="bodyBold">{o.target_nick}</Text> 님에게 신청</Text>
            <Text variant="caption" color={o.status === 'pending' ? colors.light.devilBlue : colors.light.devilSub}>{STATUS_LABEL[o.status]}</Text>
          </View>
          <View style={styles.swapRow}>
            <View style={styles.side}><Text variant="caption" color={colors.light.devilSub}>내가 줌</Text><Avatar id={o.offer_contestant_id} /></View>
            <Text variant="h2" color={colors.light.devilSub}>↔</Text>
            <View style={styles.side}><Text variant="caption" color={colors.light.devilSub}>내가 받음</Text><Avatar id={o.request_contestant_id} /></View>
          </View>
          {o.cash > 0 && (
            <View style={styles.cashChip}><Text variant="bodySm" color="#DC2626">💵 현금 {o.cash.toLocaleString()}원 보냄 (내가 송금)</Text></View>
          )}
          {o.status === 'pending' && (
            <View style={styles.actions}>
              <Button label="신청 취소" variant="secondary" loading={cancelMut.isPending} onPress={() => cancelMut.mutate(o.id)} style={styles.rejectBtn} />
            </View>
          )}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.xl, marginBottom: space.md, fontSize: 12, letterSpacing: 0.5 },
  emptyBox: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.xl, alignItems: 'center' },
  card: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginBottom: space.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  swapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  cashChip: { alignSelf: 'center', marginTop: space.md, backgroundColor: colors.light.paper, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 6 },
  side: { alignItems: 'center', gap: space.xs },
  pair: { alignItems: 'center', width: 64 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.light.hairline },
  pairName: { marginTop: space.xs, maxWidth: 64 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  rejectBtn: { flex: 1, borderRadius: radius.pill },
  acceptBtn: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
});
