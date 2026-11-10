/**
 * 회차 시청 관리 — 체크는 임시, '시청 완료 등록하기'(devil_save_watch RPC)로만 저장.
 * 이 페이지는 탈락자·결과·스포일러 정보를 절대 표시하지 않는다(시청 여부만). (09-DEVIL-RULES §4, §6-1)
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Circle, Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { EPISODES, EPISODE_RELEASE } from '@/features/event/devilAssets';
import { getMyWatch, listTradeOffers, saveWatch } from '@/api/devil';

// 탈락자 등록 진입 노출 여부. 당분간 숨김(결과 데이터가 쌓이지 않아 어디에도 탈락 내용이 공개되지 않음).
const SHOW_REGISTER = false;

export default function EpisodesScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { data: saved = [] } = useQuery({ queryKey: ['devil', 'watch', userId], queryFn: () => getMyWatch(userId as string), enabled: !!userId });
  const { data: offers = [] } = useQuery({ queryKey: ['devil', 'offers'], queryFn: listTradeOffers, enabled: !!userId });

  const [confirmed, setConfirmed] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<Set<number>>(new Set());

  useEffect(() => {
    const s = new Set(saved);
    setConfirmed(s);
    setPending(new Set(s));
  }, [saved]);

  const saveMut = useMutation({
    mutationFn: () => saveWatch([...pending]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devil', 'watch'] });
      qc.invalidateQueries({ queryKey: ['devil', 'elims'] }); // 시청 범위 변경 → 결과 접근 재계산
      Alert.alert('시청 기록 저장', '시청 기록이 저장되었습니다.');
    },
    onError: (e) => Alert.alert('저장 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  // 진행 중 트레이드 신청이 있으면 시청기록 저장 차단(같은 진도끼리만 트레이드 가능하므로).
  function handleSave() {
    const incoming = offers.some((o) => o.status === 'pending' && o.target_id === userId);
    const outgoing = offers.some((o) => o.status === 'pending' && o.proposer_id === userId);
    if (incoming || outgoing) {
      Alert.alert(
        '트레이드 먼저 처리',
        incoming
          ? '받은 트레이드 신청에 먼저 응답해야 시청 기록을 저장할 수 있어요.'
          : '보낸 트레이드 신청이 처리(수락/거절/취소)되어야 시청 기록을 저장할 수 있어요.',
        [{ text: '닫기', style: 'cancel' }, { text: '신청함으로', onPress: () => router.push('/event/trade-offers') }],
      );
      return;
    }
    saveMut.mutate();
  }

  function toggle(ep: number) {
    setPending((cur) => {
      const next = new Set(cur);
      next.has(ep) ? next.delete(ep) : next.add(ep);
      return next;
    });
  }

  const hasChanges = pending.size !== confirmed.size || [...pending].some((ep) => !confirmed.has(ep));

  function epState(ep: number): 'confirmed' | 'new' | 'removing' | 'off' {
    const c = confirmed.has(ep), p = pending.has(ep);
    if (c && p) return 'confirmed';
    if (!c && p) return 'new';
    if (c && !p) return 'removing';
    return 'off';
  }

  const statusLink = (
    <Pressable onPress={() => router.push('/event/watch-status')} hitSlop={8} style={styles.statusLink}>
      <Text variant="bodySm" color={colors.light.devilBlue}>시청 현황 ›</Text>
    </Pressable>
  );

  return (
    <Screen scroll>
      <DetailHeader right={statusLink} />
      <Text variant="h1" color={colors.light.devilInk}>회차 시청 관리</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        시청한 회차를 선택 후,{'\n'}아래 버튼을 눌러야 저장됩니다.
      </Text>

      <View style={styles.grid}>
        {EPISODES.map((ep) => {
          const state = epState(ep);
          const isOn = state === 'confirmed' || state === 'new';
          const isRemoving = state === 'removing';
          return (
            <Pressable
              key={ep}
              style={[styles.cell, isOn ? styles.cellOn : isRemoving ? styles.cellRemoving : styles.cellOff]}
              onPress={() => toggle(ep)}
            >
              {EPISODE_RELEASE[ep] ? (
                <Text variant="caption" color={isOn ? colors.light.devilBlue : colors.light.devilSub} style={styles.cellDate}>{EPISODE_RELEASE[ep]} 개봉</Text>
              ) : null}
              <Text variant="bodyBold" color={isOn ? colors.light.devilBlue : isRemoving ? colors.light.devilAmber : colors.light.devilInk}>{ep}화</Text>
              <Text
                variant="caption"
                color={isOn ? colors.light.devilBlue : isRemoving ? colors.light.devilAmber : colors.light.devilSub}
                style={styles.cellStatus}
              >
                {state === 'confirmed' ? '✓ 시청완료' : state === 'new' ? '+ 선택됨' : state === 'removing' ? '취소 예정' : '미시청'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.infoChip}>
        <View style={styles.infoDot}>
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Circle cx="12" cy="12" r="12" fill={colors.light.devilBlue} />
            <Path d="M12 7.5v.5M12 11v6" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </View>
        <Text variant="bodySm" color={colors.light.devilSub} style={{ flex: 1 }}>
          선택 후 아래 버튼을 눌러야 저장됩니다.{'\n'}버튼을 누르지 않으면 반영되지 않아요!
        </Text>
      </View>

      <Button
        label={hasChanges ? '시청 완료 등록하기' : '변경사항 없음'}
        block
        disabled={!hasChanges}
        loading={saveMut.isPending}
        onPress={handleSave}
        style={styles.cta}
      />

      {/* 탈락자 등록 — 일단 숨김(SHOW_REGISTER=false). 되살리려면 true로. */}
      {SHOW_REGISTER ? (
        <Pressable onPress={() => router.push('/event/register')} style={({ pressed }) => [styles.registerRow, pressed && styles.registerPressed]}>
          <Text style={styles.registerEmoji}>✍️</Text>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" color={colors.light.devilInk}>탈락자 등록</Text>
            <Text variant="bodySm" color={colors.light.devilSub}>이번 회차 탈락자를 직접 등록해요 (먼저 본 사람 누구나)</Text>
          </View>
          <Text variant="body" color={colors.light.devilSub}>›</Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md, marginTop: space.xl },
  cell: { width: '31%', aspectRatio: 1.18, borderRadius: radius.card, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cellOff: { backgroundColor: colors.light.devilCellBg, borderColor: 'transparent' },
  cellOn: { backgroundColor: colors.light.devilBlueWash, borderColor: colors.light.devilBlue },
  cellRemoving: { backgroundColor: '#FEF9C3', borderColor: colors.light.devilAmber },
  cellDate: { fontSize: 10, lineHeight: 13, marginBottom: 2 },
  cellStatus: { marginTop: 2 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginTop: space.xl },
  infoDot: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  cta: { marginTop: space.xl, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  registerRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg, marginTop: space.md },
  registerPressed: { opacity: 0.9 },
  registerEmoji: { fontSize: 20, lineHeight: 24 },
  statusLink: { paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.light.devilBlueWash },
});
