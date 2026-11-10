/**
 * 나의 예측 생존 현황 — 내 픽 2명의 현재 상태. 내 연속 시청 완료 범위까지만 반영.
 * 범위 밖 탈락 정보는 RLS로 애초에 오지 않음. "최종 생존자/우승자" 표현 금지. (09-DEVIL-RULES §7)
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE } from '@/features/event/devilAssets';
import { getMyPicks, getMyWatch, listContestants, listVisibleEliminations, watchThrough } from '@/api/devil';

export default function MySurvivalScreen() {
  const { userId } = useAuth();
  const router = useRouter();

  // 진입 시 스포일러 확인 팝업 — 동의해야 생존 현황을 보여준다.
  const [revealed, setRevealed] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    Alert.alert(
      '나의 예측 생존 현황',
      '현재 회차까지 최신화된 결과입니다. 확인하시겠습니까?',
      [
        { text: '아니오', style: 'cancel', onPress: () => router.back() },
        { text: '예', onPress: () => setRevealed(true) },
      ],
    );
  }, [router]);
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: myPicks = [] } = useQuery({ queryKey: ['devil', 'myPicks', userId], queryFn: () => getMyPicks(userId as string), enabled: !!userId });
  const { data: watched = [] } = useQuery({ queryKey: ['devil', 'watch', userId], queryFn: () => getMyWatch(userId as string), enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });

  const through = watchThrough(watched);
  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);
  const elimAt = useMemo(() => Object.fromEntries(elims.map((e) => [e.contestant_id, e.episode])), [elims]);

  // 미동의 상태 — 내용 숨김(팝업 응답 대기/취소)
  if (!revealed) {
    return (
      <Screen scroll>
        <DetailHeader />
        <Text variant="h1" color={colors.light.devilInk}>나의 예측 생존 현황</Text>
        <View style={styles.gate}>
          <Text style={styles.gateEmoji}>🔒</Text>
          <Text variant="bodySm" color={colors.light.devilSub} style={styles.gateText}>스포일러 확인에 동의하면 생존 현황이 표시돼요.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>나의 예측 생존 현황</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        {through > 0 ? `현재 ${through}화까지 시청 완료 기준이에요.` : '아직 시청 완료한 회차가 없어요.'}
      </Text>

      {myPicks.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text variant="bodySm" color={colors.light.devilSub}>아직 예측한 출연자가 없어요.{'\n'}나의 예측에서 2명을 선택해주세요.</Text>
        </View>
      ) : (
        <View style={styles.cards}>
          {myPicks.map((id) => {
            const deadAt = elimAt[id];
            const alive = deadAt === undefined;
            return (
              <View key={id} style={[styles.card, !alive && styles.cardElim]}>
                <Image source={CONTESTANT_IMAGE[id]} style={styles.avatar} />
                <View style={styles.cardInfo}>
                  <Text variant="bodyBold" color={colors.light.devilInk}>{nameOf[id] ?? '?'}</Text>
                  {alive ? (
                    <View style={[styles.badge, styles.badgeAlive]}>
                      <Svg width={14} height={14} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="12" fill="#16A34A" /><Path d="M7 12.5l3.2 3.2L17 9" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
                      <Text variant="caption" color="#16A34A" style={styles.badgeText}>{through}화 기준 생존 중</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, styles.badgeElim]}>
                      <Svg width={14} height={14} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="12" fill="#DC2626" /><Path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth={2} strokeLinecap="round" fill="none" /></Svg>
                      <Text variant="caption" color="#DC2626" style={styles.badgeText}>{deadAt}화 탈락</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.note}>
        <Text variant="caption" color={colors.light.devilSub}>
          현재 생존 중인 출연자는 최종 생존자·우승자가 아닙니다.{'\n'}
          최종 예측 성공·실패는 최종 결과 공개 후 확인 가능해요.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  emptyBox: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.xl, alignItems: 'center', marginTop: space.xl },
  cards: { gap: space.md, marginTop: space.xl },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.lg, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg },
  cardElim: { opacity: 0.65 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.light.hairline },
  cardInfo: { flex: 1, gap: space.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start', paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill },
  badgeAlive: { backgroundColor: '#DCFCE7' },
  badgeElim: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11 },
  note: { marginTop: space.xl, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg },
  gate: { alignItems: 'center', marginTop: space.section, gap: space.md },
  gateEmoji: { fontSize: 44, lineHeight: 52 },
  gateText: { textAlign: 'center' },
});
