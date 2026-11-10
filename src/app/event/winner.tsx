/**
 * 최종 결과 — 최종 우승자 + 내 예측 성공 여부. 회차 결과와 분리된 최상위 스포일러.
 * 공개 조건(09-DEVIL-RULES §10): 14화 전체 시청 OR 별도 동의 OR 관리자.
 *  - 미충족: 경고 + '결과 확인(동의)' 버튼만.
 *  - 충족 + 우승자 미정: '결과 확정 전'.
 *  - 충족 + 우승자 확정: 컨페티 + 월계관 연출.
 */
import { useMemo } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { canSeeFinal, getFinalWinner, getMyPicks, giveFinalConsent, listContestants } from '@/api/devil';

const CONFETTI = [
  { c: '#60A5FA', x: 40, y: 20, r: '18deg' }, { c: '#FBBF24', x: 300, y: 10, r: '-20deg' },
  { c: '#38BDF8', x: 30, y: 90, r: '40deg' }, { c: '#A78BFA', x: 330, y: 80, r: '15deg' },
  { c: '#FB923C', x: 320, y: 150, r: '-30deg' }, { c: '#FB7185', x: 350, y: 220, r: '25deg' },
  { c: '#FBBF24', x: 20, y: 200, r: '10deg' }, { c: '#C7D2FE', x: 70, y: 150, r: '-15deg' },
];

const LAUREL = 'M34 6 C6 24 6 96 34 114 M30 24c-10 0-14 6-14 6s4 6 14 6 M26 44c-10 0-14 6-14 6s4 6 14 6 M24 64c-10 0-14 6-14 6s4 6 14 6 M26 84c-10 0-14 6-14 6s4 6 14 6';

export default function WinnerScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();

  const { data: allowed, isLoading: loadingGate } = useQuery({ queryKey: ['devil', 'canFinal', userId], queryFn: () => canSeeFinal(userId as string), enabled: !!userId });
  const { data: winnerId } = useQuery({ queryKey: ['devil', 'winner'], queryFn: getFinalWinner, enabled: !!userId && allowed === true });
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: myPicks = [] } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId && allowed === true });

  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);

  const consentMut = useMutation({
    mutationFn: () => giveFinalConsent(userId as string),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['devil', 'canFinal'] }),
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function confirmConsent() {
    Alert.alert('최종 결과 확인', '최종 우승자와 예측 성공 여부가 공개됩니다.\n정말 확인하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      { text: '확인', onPress: () => consentMut.mutate() },
    ]);
  }

  // 게이트 미충족 → 경고 + 동의 버튼
  if (!loadingGate && allowed === false) {
    return (
      <Screen scroll>
        <DetailHeader />
        <Text variant="h1" color={colors.light.devilInk}>최종 결과</Text>
        <View style={styles.gate}>
          <Text style={styles.gateEmoji}>🔒</Text>
          <Text variant="h2" color={colors.light.devilInk} style={styles.gateTitle}>최종 결과는 보호되어 있어요</Text>
          <Text variant="body" color={colors.light.devilSub} style={styles.gateDesc}>
            전체 회차(14화) 시청을 완료하거나,{'\n'}아래에서 스포일러 확인에 동의하면{'\n'}최종 우승자를 볼 수 있어요.
          </Text>
        </View>
        <Button label="결과 확인(스포일러 동의)" block loading={consentMut.isPending} onPress={confirmConsent} style={styles.consentBtn} />
        <Button label="이벤트 홈으로" variant="secondary" onPress={() => router.replace('/events')} block style={styles.homeBtn} />
      </Screen>
    );
  }

  // 공개 조건 충족 + 우승자 미정
  if (allowed && (winnerId === null || winnerId === undefined)) {
    return (
      <Screen scroll>
        <DetailHeader />
        <Text variant="h1" color={colors.light.devilInk}>최종 결과</Text>
        <View style={styles.gate}>
          <Text style={styles.gateEmoji}>⏳</Text>
          <Text variant="h2" color={colors.light.devilInk} style={styles.gateTitle}>결과 확정 전이에요</Text>
          <Text variant="body" color={colors.light.devilSub} style={styles.gateDesc}>아직 최종 우승자가 확정되지 않았어요.{'\n'}이벤트 종료 후 공개됩니다.</Text>
        </View>
        <Button label="이벤트 홈으로" variant="secondary" onPress={() => router.replace('/events')} block style={styles.homeBtn} />
      </Screen>
    );
  }

  if (!winnerId) return <Screen><DetailHeader /></Screen>;

  const success = myPicks.includes(winnerId);

  return (
    <Screen scroll>
      <DetailHeader />
      <View style={styles.confettiLayer} pointerEvents="none">
        {CONFETTI.map((p, i) => (
          <View key={i} style={[styles.confetti, { backgroundColor: p.c, left: p.x, top: p.y, transform: [{ rotate: p.r }] }]} />
        ))}
      </View>

      <View style={styles.center}>
        <Text style={styles.trophy}>🏆</Text>
        <Text variant="h1" color={colors.light.devilInk} style={styles.heading}>데블스 플랜{'\n'}최종 우승자</Text>

        <View style={styles.laurelRow}>
          <Svg width={40} height={120} viewBox="0 0 40 120"><Path d={LAUREL} stroke={colors.light.devilAmber} strokeWidth={4.5} strokeLinecap="round" fill="none" /></Svg>
          <View style={styles.avatarRing}><Image source={CONTESTANT_IMAGE[winnerId]} style={styles.avatar} /></View>
          <Svg width={40} height={120} viewBox="0 0 40 120" style={styles.flip}><Path d={LAUREL} stroke={colors.light.devilAmber} strokeWidth={4.5} strokeLinecap="round" fill="none" /></Svg>
        </View>
        <View style={styles.namePlate}>
          <Text variant="bodyBold" color={colors.light.paper} style={styles.nameText}>{nameOf[winnerId] ?? '?'}</Text>
        </View>

        {/* 내 예측 성공 여부 */}
        <View style={[styles.resultChip, success ? styles.resultWin : styles.resultLose]}>
          <Text variant="bodyBold" color={success ? '#16A34A' : '#DC2626'}>
            {success ? '🎉 예측 성공! 우승자를 맞혔어요' : '아쉽게도 예측에 없었어요'}
          </Text>
        </View>

        {/* 보상 안내 */}
        <View style={styles.rewardCard}>
          <Text style={styles.rewardEmoji}>🎁</Text>
          <Text variant="bodyBold" color={colors.light.devilInk} style={styles.rewardText}>
            {success
              ? '이벤트 우승! 나머지 멤버에게\n각자 1만원 상당 상품을 받아요'
              : '이벤트 우승자는 나머지 멤버에게\n각자 1만원 상당 상품을 받아요'}
          </Text>
        </View>
      </View>

      <Button label="⤴  결과 공유하기" color={colors.light.devilBlue} onPress={() => Alert.alert('공유', '결과 공유 기능은 다음 단계에서 연결됩니다.')} block style={styles.shareBtn} />
      <Button label="이벤트 홈으로" variant="secondary" onPress={() => router.replace('/events')} block style={styles.homeBtn} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gate: { alignItems: 'center', marginTop: space.section, paddingHorizontal: space.lg },
  gateEmoji: { fontSize: 48, lineHeight: 56 },
  gateTitle: { marginTop: space.lg, textAlign: 'center' },
  gateDesc: { marginTop: space.md, textAlign: 'center', lineHeight: 22 },
  consentBtn: { marginTop: space.section, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  confettiLayer: { ...StyleSheet.absoluteFillObject, height: 280 },
  confetti: { position: 'absolute', width: 14, height: 9, borderRadius: 2 },
  center: { alignItems: 'center', marginTop: space.lg },
  trophy: { fontSize: 50, lineHeight: 58 },
  heading: { textAlign: 'center', marginTop: space.sm },
  laurelRow: { flexDirection: 'row', alignItems: 'center', marginTop: space.xl },
  flip: { transform: [{ scaleX: -1 }] },
  avatarRing: { width: 132, height: 132, borderRadius: 66, overflow: 'hidden', backgroundColor: colors.light.devilCellBg, marginHorizontal: -6 },
  avatar: { width: '100%', height: '100%' },
  namePlate: { marginTop: -18, backgroundColor: colors.light.devilAmberLight, borderRadius: radius.pill, paddingHorizontal: space.xl, paddingVertical: 7 },
  nameText: { fontSize: 17 },
  rewardCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch', backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, padding: space.lg, marginTop: space.lg },
  rewardEmoji: { fontSize: 28, lineHeight: 34 },
  rewardText: { flex: 1, lineHeight: 22 },
  resultChip: { marginTop: space.xl, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill },
  resultWin: { backgroundColor: '#DCFCE7' },
  resultLose: { backgroundColor: '#FEE2E2' },
  shareBtn: { marginTop: space.section, borderRadius: radius.pill, backgroundColor: colors.light.devilBlueWash, borderColor: 'transparent' },
  homeBtn: { marginTop: space.md, borderRadius: radius.pill, borderColor: colors.light.hairlineStrong },
});
