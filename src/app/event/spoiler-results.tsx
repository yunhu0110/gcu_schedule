/**
 * 회차당 결과 확인 — 연속 시청 완료 범위 내 회차만 열람(서버 RLS로 강제).
 * 회차 탭 → 스포일러 경고 → 해당 회차 탈락자 '팝업'으로 표시.
 * 하단 '전체 생존자 확인' → 확인 팝업(예/아니오) → 생존자 화면. (09-DEVIL-RULES §6, §8)
 */
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { Popup } from '@/components/Popup';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE, EPISODES } from '@/features/event/devilAssets';
import { getMyWatch, listContestants, listVisibleEliminations, watchThrough } from '@/api/devil';

export default function SpoilerResultsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const [popupEp, setPopupEp] = useState<number | null>(null);

  const { data: watched = [] } = useQuery({ queryKey: ['devil', 'watch', userId], queryFn: () => getMyWatch(userId as string), enabled: !!userId });
  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });

  const through = watchThrough(watched);
  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);
  const popupElims = popupEp === null ? [] : elims.filter((e) => e.episode === popupEp);

  function handleTap(ep: number) {
    if (ep > through) {
      Alert.alert('시청 후 확인 가능', `${ep}화는 아직 시청하지 않았어요.\n회차 시청 관리에서 등록 후 확인할 수 있어요.`);
      return;
    }
    Alert.alert(
      `${ep}화 결과를 확인하시겠습니까?`,
      '결과에는 탈락자 정보가 포함되어 있습니다.',
      [{ text: '취소', style: 'cancel' }, { text: '확인', onPress: () => setPopupEp(ep) }],
    );
  }

  function openSurvivors() {
    Alert.alert(
      '전체 생존자 확인',
      '최신 회차가 반영된 최신 생존자 현황입니다. 확인하시겠습니까?',
      [{ text: '아니오', style: 'cancel' }, { text: '예', onPress: () => router.push('/event/survivors') }],
    );
  }

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>회차당 결과 확인</Text>

      <View style={styles.rangeChip}>
        <Svg width={16} height={16} viewBox="0 0 24 24"><Circle cx="12" cy="12" r="12" fill={colors.light.devilBlue} /><Path d="M12 7.5v.5M12 11v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" /></Svg>
        <Text variant="bodySm" color={colors.light.devilBlue} style={{ flex: 1 }}>
          {through > 0 ? `현재 ${through}화까지 시청 완료 · ${through}화까지 결과 확인 가능` : '아직 시청 완료한 회차가 없어요. 회차 시청 관리에서 등록해주세요.'}
        </Text>
      </View>

      <View style={styles.grid}>
        {EPISODES.map((ep) => {
          const unlocked = ep <= through;
          return (
            <Pressable key={ep} style={[styles.cell, unlocked ? styles.cellOn : styles.cellOff]} onPress={() => handleTap(ep)}>
              {!unlocked && (
                <Svg width={18} height={18} viewBox="0 0 24 24" style={styles.lockIcon}>
                  <Path d="M6 10V7a6 6 0 0 1 12 0v3" stroke={colors.light.devilSub} strokeWidth={2} strokeLinecap="round" fill="none" />
                  <Path d="M4 10h16v12H4z" fill={colors.light.devilCellBg} stroke={colors.light.hairline} strokeWidth={1.5} strokeLinejoin="round" />
                  <Circle cx="12" cy="16" r="2" fill={colors.light.devilSub} />
                </Svg>
              )}
              <Text variant="bodyBold" color={unlocked ? colors.light.devilBlue : colors.light.devilSub}>{ep}화</Text>
              <Text variant="caption" color={unlocked ? colors.light.devilBlue : colors.light.hairlineStrong} style={styles.cellSub}>{unlocked ? '결과 보기' : '잠금'}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 전체 생존자 확인 */}
      <Pressable onPress={openSurvivors} style={({ pressed }) => [styles.survivorsRow, pressed && styles.pressed]}>
        <Text style={styles.survivorsEmoji}>👥</Text>
        <View style={{ flex: 1 }}>
          <Text variant="bodyBold" color={colors.light.devilInk}>전체 생존자 확인</Text>
          <Text variant="bodySm" color={colors.light.devilSub}>내 시청 범위까지의 생존자 현황을 봐요</Text>
        </View>
        <Text variant="body" color={colors.light.devilSub}>›</Text>
      </Pressable>

      <Text variant="caption" color={colors.light.devilSub} style={styles.note}>
        시청하지 않은 회차는 잠금 상태로, 결과를 확인할 수 없어요.
      </Text>

      {/* 회차 탈락자 팝업 */}
      <Popup visible={popupEp !== null} onClose={() => setPopupEp(null)}>
        <Pressable style={styles.popup} onPress={() => {}}>
            <Text variant="h2" color={colors.light.devilInk} style={styles.popupTitle}>{popupEp}화 탈락자</Text>
            {popupElims.length === 0 ? (
              <Text variant="body" color={colors.light.devilSub} style={styles.popupEmpty}>이 회차에 등록된 탈락자가 없어요.</Text>
            ) : (
              <View style={styles.popupList}>
                {popupElims.map((e) => (
                  <View key={e.contestant_id} style={styles.popupItem}>
                    <Image source={CONTESTANT_IMAGE[e.contestant_id]} style={styles.popupAvatar} />
                    <Text variant="bodyBold" color={colors.light.devilInk}>{nameOf[e.contestant_id] ?? '?'}</Text>
                  </View>
                ))}
              </View>
            )}
            <Button label="확인" block onPress={() => setPopupEp(null)} style={styles.popupBtn} />
        </Pressable>
      </Popup>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rangeChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.light.devilBlueWash, borderRadius: radius.soft, padding: space.lg, marginTop: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md, marginTop: space.xl },
  cell: { width: '31%', aspectRatio: 1.18, borderRadius: radius.card, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellOn: { backgroundColor: colors.light.devilBlueWash, borderColor: colors.light.devilBlue },
  cellOff: { backgroundColor: colors.light.devilCellBg, borderColor: 'transparent' },
  lockIcon: { marginBottom: 2 },
  cellSub: { marginTop: 2 },
  pressed: { opacity: 0.9 },
  survivorsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginTop: space.xl },
  survivorsEmoji: { fontSize: 22, lineHeight: 28 },
  note: { textAlign: 'center', marginTop: space.xl, lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,18,0.45)', justifyContent: 'center', paddingHorizontal: space.xl },
  popup: { backgroundColor: colors.light.paper, borderRadius: radius.hero, padding: space.xl },
  popupTitle: { textAlign: 'center' },
  popupEmpty: { textAlign: 'center', marginTop: space.lg, marginBottom: space.sm },
  popupList: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.lg, marginTop: space.lg },
  popupItem: { alignItems: 'center', gap: space.sm, width: 88 },
  popupAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.light.devilCellBg },
  popupBtn: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
});
