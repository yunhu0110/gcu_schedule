/**
 * 나의 예측 — 우승 예상 2명 선택. 서버 저장(devil_set_picks RPC).
 * 다른 참여자가 이미 가진 출연자/탈락자는 선택 불가(비활성 표시). 완료 → 회차 시청 관리.
 * 하단 트레이드 진입. (09-DEVIL-RULES §2, §3)
 */
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyPicks, listContestants, listPredictions, listVisibleEliminations, setMyPicks } from '@/api/devil';

const MAX = 2;

export default function PredictionScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [picked, setPicked] = useState<number[]>([]);

  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: myPicks } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId });
  const { data: allPreds = [] } = useQuery({ queryKey: ['devil', 'predictions'], queryFn: listPredictions, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });

  useEffect(() => { if (myPicks) setPicked(myPicks); }, [myPicks]);

  // 다른 멤버가 가진 출연자 / 탈락자 → 선택 불가
  const takenByOther = new Set(allPreds.filter((p) => p.member_id !== userId).map((p) => p.contestant_id));
  const eliminated = new Set(elims.map((e) => e.contestant_id));

  const saveMut = useMutation({
    mutationFn: () => setMyPicks(picked),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devil', 'myPicks'] });
      qc.invalidateQueries({ queryKey: ['devil', 'predictions'] });
      router.push('/event/episodes');
    },
    onError: (e) => Alert.alert('저장 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function toggle(id: number) {
    if (takenByOther.has(id) || eliminated.has(id)) return;
    setPicked((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= MAX) {
        Alert.alert('최대 2명', '예측은 최대 2명까지 선택할 수 있어요. 바꾸려면 기존 선택을 먼저 해제해주세요.');
        return cur;
      }
      return [...cur, id];
    });
  }

  function done() {
    if (picked.length !== MAX) { Alert.alert('2명 선택', '우승 예상 출연자를 2명 선택해주세요.'); return; }
    saveMut.mutate();
  }

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>나의 예측</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>우승에 가까운 2명을 선택해주세요!</Text>

      <View style={styles.countPill}>
        <Text variant="caption" color={colors.light.devilBlue} style={styles.countText}>선택 {picked.length} / {MAX}명</Text>
      </View>

      <View style={styles.grid}>
        {contestants.map((c) => {
          const on = picked.includes(c.id);
          const disabled = !on && (takenByOther.has(c.id) || eliminated.has(c.id));
          return (
            <Pressable key={c.id} style={styles.cell} onPress={() => toggle(c.id)} disabled={disabled}>
              <View style={[styles.avatarWrap, on && styles.avatarOn, disabled && styles.avatarDisabled]}>
                <Image source={CONTESTANT_IMAGE[c.id]} style={styles.avatar} />
                {disabled && <View style={styles.disabledOverlay} />}
              </View>
              {on ? (
                <View style={styles.check}><Text color={colors.light.paper} style={styles.checkMark}>✓</Text></View>
              ) : null}
              <Text variant="caption" numberOfLines={1} style={[styles.name, on && styles.nameOn]} color={on ? colors.light.devilInk : colors.light.devilSub}>{c.name}</Text>
              {disabled && <Text variant="caption" color={colors.light.hairlineStrong} style={styles.tag}>{eliminated.has(c.id) ? '탈락' : '선택됨'}</Text>}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.actions}>
        <Button label="초기화" variant="secondary" onPress={() => setPicked([])} style={styles.resetBtn} />
        <Button label="완료" onPress={done} loading={saveMut.isPending} style={styles.doneBtn} />
      </View>

      <Pressable onPress={() => router.push('/event/trade')} style={({ pressed }) => [styles.tradeRow, pressed && styles.tradePressed]}>
        <Text style={styles.tradeEmoji}>🔄</Text>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" color={colors.light.devilBlue}>트레이드</Text>
          <Text variant="bodySm" color={colors.light.devilSub}>FA 시장에서 출연자를 교체할 수 있어요</Text>
        </View>
        <Text variant="body" color={colors.light.devilSub}>›</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  countPill: { alignSelf: 'flex-start', backgroundColor: colors.light.devilBlueWash, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6, marginTop: space.lg },
  countText: { fontSize: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.xl, marginTop: space.xl },
  cell: { width: '22%', alignItems: 'center' },
  avatarWrap: { width: '100%', aspectRatio: 1, borderRadius: 999, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden', backgroundColor: colors.light.devilCellBg },
  avatarOn: { borderColor: colors.light.devilBlue },
  avatarDisabled: { opacity: 0.55 },
  disabledOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.35)' },
  avatar: { width: '100%', height: '100%' },
  check: { position: 'absolute', right: '12%', top: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.light.devilBlue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.light.paper },
  checkMark: { fontSize: 12, lineHeight: 15 },
  name: { marginTop: space.sm, maxWidth: '100%' },
  nameOn: { fontFamily: 'NotoSansKR_700Bold' },
  tag: { fontSize: 10, marginTop: 1 },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.section },
  resetBtn: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.light.devilCellBg, borderColor: 'transparent' },
  doneBtn: { flex: 1.6, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  tradeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginTop: space.md },
  tradePressed: { opacity: 0.9 },
  tradeEmoji: { fontSize: 20, lineHeight: 24 },
});
