/**
 * 상대와 트레이드 신청 — 내 선수 1명 + 상대 보유 선수 1명 선택 → 신청(devil_propose_trade).
 * 상대가 수락해야 성사된다. 탈락 선수/FA는 제외. (사용자 요청: 수락 기반 P2P 트레이드)
 */
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyPicks, listContestants, listPredictions, listSyncMemberIds, listVisibleEliminations, proposeTrade } from '@/api/devil';

export default function TradeProposeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [offer, setOffer] = useState<number | null>(null);
  const [request, setRequest] = useState<number | null>(null);
  const [cash, setCash] = useState('');
  const [cashModal, setCashModal] = useState(false);

  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: myPicks = [] } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId });
  const { data: preds = [] } = useQuery({ queryKey: ['devil', 'predictions'], queryFn: listPredictions, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });
  const { data: syncIds = [] } = useQuery({ queryKey: ['devil', 'sync'], queryFn: listSyncMemberIds, enabled: !!userId });

  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);
  const eliminatedIds = useMemo(() => new Set(elims.map((e) => e.contestant_id)), [elims]);
  const syncSet = useMemo(() => new Set(syncIds), [syncIds]);

  // 시청 진도가 같은(싱크) 상대만, 멤버별 그룹
  const othersByMember = useMemo(() => {
    const m = new Map<string, { nickname: string; ids: number[] }>();
    for (const p of preds) {
      if (p.member_id === userId) continue;
      if (!syncSet.has(p.member_id)) continue; // 싱크 안 맞으면 제외
      if (eliminatedIds.has(p.contestant_id)) continue;
      const cur = m.get(p.member_id) ?? { nickname: p.nickname, ids: [] };
      cur.ids.push(p.contestant_id);
      m.set(p.member_id, cur);
    }
    return [...m.entries()];
  }, [preds, userId, eliminatedIds, syncSet]);

  const cashNum = Math.max(0, Math.floor(Number(cash.replace(/[^0-9]/g, '')) || 0));

  const mut = useMutation({
    mutationFn: (amount: number) => proposeTrade(offer as number, request as number, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devil', 'offers'] });
      setCashModal(false);
      Alert.alert('신청 완료', '트레이드 신청을 보냈어요.\n상대가 수락하면 교환됩니다.');
      router.back();
    },
    onError: (e) => Alert.alert('신청 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  // 신청하기 → "현금을 추가해서 제안하시겠습니까?" → 아니오: 선수끼리 / 예: 금액 입력 모달
  function submit() {
    if (offer === null || request === null) { Alert.alert('선택 필요', '내 선수와 상대 선수를 각각 선택해주세요.'); return; }
    Alert.alert('현금을 추가해서 제안하시겠습니까?', `내 ${nameOf[offer]} ↔ 상대 ${nameOf[request]}`, [
      { text: '아니오 (선수끼리)', onPress: () => mut.mutate(0) },
      { text: '예 (현금 추가)', onPress: () => { setCash(''); setCashModal(true); } },
    ]);
  }

  const availOffer = myPicks.filter((id) => !eliminatedIds.has(id));

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>상대와 트레이드 신청</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        내 선수와 상대 선수를 1명씩 선택해 신청하세요. 상대가 수락하면 교환됩니다.{'\n'}
        시청 진도(연속 완료 범위)가 같은 참여자와만 교환할 수 있어요.
      </Text>

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>내가 내놓을 선수</Text>
      {availOffer.length === 0 ? (
        <View style={styles.emptyBox}><Text variant="bodySm" color={colors.light.devilSub}>교환 가능한 내 선수가 없어요.</Text></View>
      ) : (
        <View style={styles.myGrid}>
          {availOffer.map((id) => {
            const on = offer === id;
            return (
              <Pressable key={id} style={[styles.bigCell, on && styles.bigCellOn]} onPress={() => setOffer(on ? null : id)}>
                <Image source={CONTESTANT_IMAGE[id]} style={styles.bigAvatar} />
                <Text variant="caption" color={on ? colors.light.devilBlue : colors.light.devilInk} style={styles.bigName}>{nameOf[id]}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>원하는 상대 선수</Text>
      {othersByMember.length === 0 ? (
        <View style={styles.emptyBox}><Text variant="bodySm" color={colors.light.devilSub} style={styles.emptyText}>시청 진도가 같은 참여자가 없어요.{'\n'}트레이드는 시청 기록이 같은 사람끼리만 가능해요.</Text></View>
      ) : (
        othersByMember.map(([mid, info]) => (
          <View key={mid} style={styles.memberBlock}>
            <Text variant="bodySm" color={colors.light.devilSub} style={styles.memberName}>{info.nickname}</Text>
            <View style={styles.theirGrid}>
              {info.ids.map((id) => {
                const on = request === id;
                return (
                  <Pressable key={id} style={styles.theirCell} onPress={() => setRequest(on ? null : id)}>
                    <View style={[styles.theirAvatarWrap, on && styles.theirAvatarOn]}>
                      <Image source={CONTESTANT_IMAGE[id]} style={styles.theirAvatar} />
                    </View>
                    <Text variant="caption" color={on ? colors.light.devilBlue : colors.light.devilSub} numberOfLines={1} style={styles.theirName}>{nameOf[id]}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))
      )}

      {offer !== null && request !== null && (
        <View style={styles.preview}>
          <Text variant="bodySm" color={colors.light.devilInk}>내 {nameOf[offer]} <Text color={colors.light.devilSub}>↔</Text> 상대 {nameOf[request]}</Text>
        </View>
      )}

      <Button label="트레이드 신청하기" block disabled={offer === null || request === null} loading={mut.isPending} onPress={submit} style={styles.cta} />

      {/* 현금 추가 모달 ('예' 선택 시) */}
      <Modal visible={cashModal} transparent animationType="fade" onRequestClose={() => setCashModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text variant="h2" color={colors.light.devilInk}>현금 추가 제안</Text>
            <Text variant="bodySm" color={colors.light.devilSub} style={styles.modalSub}>
              {offer !== null && request !== null ? `내 ${nameOf[offer]} + 현금 ↔ 상대 ${nameOf[request]}` : ''}
            </Text>
            <View style={styles.cashBox}>
              <TextInput
                value={cash}
                onChangeText={(t) => setCash(t.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.light.devilSub}
                style={styles.cashInput}
                autoFocus
              />
              <Text variant="body" color={colors.light.devilSub}>원</Text>
            </View>
            <Text variant="caption" color={colors.light.devilSub} style={styles.cashHint}>
              실제 송금은 앱 밖에서 직접 하세요. 여기서는 제안 금액만 전달돼요.
            </Text>
            <View style={styles.modalActions}>
              <Button label="취소" variant="secondary" onPress={() => setCashModal(false)} style={styles.modalCancel} />
              <Button label="제안하기" loading={mut.isPending} onPress={() => mut.mutate(cashNum)} style={styles.modalConfirm} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  label: { marginTop: space.xl, marginBottom: space.md },
  emptyBox: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.xl, alignItems: 'center' },
  emptyText: { textAlign: 'center', lineHeight: 20 },
  myGrid: { flexDirection: 'row', gap: space.md },
  bigCell: { flex: 1, alignItems: 'center', backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, borderWidth: 2, borderColor: 'transparent' },
  bigCellOn: { borderColor: colors.light.devilBlue, backgroundColor: colors.light.devilBlueWash },
  bigAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.light.hairline },
  bigName: { marginTop: space.sm },
  cashBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.light.hairline, borderRadius: radius.card, paddingHorizontal: space.lg, height: 52 },
  cashInput: { flex: 1, fontFamily: fonts.body, fontSize: 16, color: colors.light.devilInk, paddingVertical: 0 },
  cashHint: { marginTop: space.sm, lineHeight: 18 },
  memberBlock: { marginTop: space.lg },
  memberName: { marginBottom: space.sm },
  theirGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  theirCell: { width: '22%', alignItems: 'center' },
  theirAvatarWrap: { width: '100%', aspectRatio: 1, borderRadius: 999, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden', backgroundColor: colors.light.devilCellBg },
  theirAvatarOn: { borderColor: colors.light.devilBlue },
  theirAvatar: { width: '100%', height: '100%' },
  theirName: { marginTop: space.xs, maxWidth: '100%' },
  preview: { flexDirection: 'row', justifyContent: 'center', backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, padding: space.lg, marginTop: space.xl },
  cta: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(8,10,18,0.45)', justifyContent: 'center', paddingHorizontal: space.xl },
  modalCard: { backgroundColor: colors.light.paper, borderRadius: radius.hero, padding: space.xl },
  modalSub: { marginTop: space.xs, marginBottom: space.lg },
  modalActions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  modalCancel: { flex: 1, borderRadius: radius.pill },
  modalConfirm: { flex: 1.4, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
});
