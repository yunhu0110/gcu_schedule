/**
 * 탈락자 등록 — 먼저 본 사람 누구나(활성 멤버). 회차 + 탈락자 선택 → 서버 저장.
 * 이미 탈락 등록된 출연자는 비활성 표시. (09-DEVIL-RULES §6, 사용자 지시: 누구나 등록)
 */
import { useMemo, useState } from 'react';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { CONTESTANT_IMAGE, EPISODES } from '@/features/event/devilAssets';
import { listContestants, listVisibleEliminations, registerElimination, setWinner } from '@/api/devil';

const LAST_EP = 14;

export default function RegisterScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [ep, setEp] = useState(1);
  const [picked, setPicked] = useState<number[]>([]);
  const [epPickerOpen, setEpPickerOpen] = useState(false);

  const isWinnerMode = ep === LAST_EP; // 마지막 화 = 최종 우승자 등록

  const { data: contestants = [] } = useQuery({ queryKey: ['devil', 'contestants'], queryFn: listContestants, enabled: !!userId });
  const { data: elims = [] } = useQuery({ queryKey: ['devil', 'elims'], queryFn: listVisibleEliminations, enabled: !!userId });
  const alreadyElim = useMemo(() => new Set(elims.map((e) => e.contestant_id)), [elims]);
  const nameOf = useMemo(() => Object.fromEntries(contestants.map((c) => [c.id, c.name])), [contestants]);

  const regMut = useMutation({
    mutationFn: async () => {
      if (isWinnerMode) {
        await setWinner(picked[0]);
      } else {
        for (const id of picked) await registerElimination(ep, id, userId as string);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devil', 'elims'] });
      qc.invalidateQueries({ queryKey: ['devil', 'winner'] });
      setPicked([]);
      Alert.alert('등록 완료', isWinnerMode ? '최종 우승자가 등록되었습니다.' : `${ep}화 탈락자가 등록되었습니다.`);
      router.back();
    },
    onError: (e) => Alert.alert('등록 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  function toggle(id: number) {
    if (!isWinnerMode && alreadyElim.has(id)) return;
    setPicked((cur) => {
      if (isWinnerMode) return cur.includes(id) ? [] : [id]; // 우승자는 1명만
      return cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    });
  }
  function selectEp(n: number) { setEp(n); setPicked([]); setEpPickerOpen(false); }
  function submit() {
    if (picked.length === 0) { Alert.alert(isWinnerMode ? '우승자 선택' : '탈락자 선택', isWinnerMode ? '최종 우승자를 선택해주세요.' : '탈락자를 1명 이상 선택해주세요.'); return; }
    const names = picked.map((id) => nameOf[id]).join(', ');
    Alert.alert(
      isWinnerMode ? '최종 우승자 등록' : '탈락자 등록',
      isWinnerMode ? `최종 우승자: ${names}\n등록하시겠습니까?` : `${ep}화 탈락자: ${names}\n등록하시겠습니까?`,
      [{ text: '취소', style: 'cancel' }, { text: '등록', onPress: () => regMut.mutate() }],
    );
  }

  return (
    <Screen scroll>
      <DetailHeader />
      <View style={styles.badge}><Text variant="caption" color={colors.light.devilBlue} style={styles.badgeText}>먼저 본 사람 등록</Text></View>
      <Text variant="h1" color={colors.light.devilInk}>{isWinnerMode ? '최종 우승자 등록하기' : '탈락자 등록하기'}</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        {isWinnerMode ? '마지막 화예요. 최종 우승자 1명을 등록해주세요.' : '이번 회차 탈락자를 직접 등록해주세요.'}
      </Text>

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>회차 선택</Text>
      <Pressable onPress={() => setEpPickerOpen(true)} style={styles.dropdown}>
        <Text variant="body" color={colors.light.devilInk}>{ep}화{isWinnerMode ? ' · 최종 우승자' : ''}</Text>
        <Svg width={20} height={20} viewBox="0 0 24 24"><Path d="M7 10l5 5 5-5" stroke={colors.light.devilSub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" /></Svg>
      </Pressable>

      <Text variant="bodyBold" color={colors.light.devilInk} style={styles.label}>{isWinnerMode ? '우승자 선택 (1명)' : '탈락자 선택'}</Text>
      <View style={styles.grid}>
        {contestants.map((c) => {
          const on = picked.includes(c.id);
          const done = !isWinnerMode && alreadyElim.has(c.id);
          return (
            <Pressable key={c.id} style={styles.cell} onPress={() => toggle(c.id)} disabled={done}>
              <View style={[styles.avatarWrap, on && (isWinnerMode ? styles.avatarWin : styles.avatarOn)]}>
                <Image source={CONTESTANT_IMAGE[c.id]} style={styles.avatar} />
                {done && <View style={styles.doneOverlay} />}
              </View>
              {on ? <View style={[styles.check, isWinnerMode && styles.checkWin]}><Text color={colors.light.paper} style={styles.checkMark}>{isWinnerMode ? '♛' : '✓'}</Text></View> : null}
              <Text variant="caption" numberOfLines={1} style={styles.name} color={on ? colors.light.devilInk : colors.light.devilSub}>{c.name}</Text>
              {done && <Text variant="caption" color={colors.light.hairlineStrong} style={styles.doneTag}>등록됨</Text>}
            </Pressable>
          );
        })}
      </View>

      <Button label={isWinnerMode ? '우승자 등록하기' : '등록하기'} block loading={regMut.isPending} onPress={submit} style={StyleSheet.flatten([styles.cta, isWinnerMode && styles.ctaWin])} />

      {/* 회차 리스트박스 */}
      <Modal visible={epPickerOpen} transparent animationType="fade" onRequestClose={() => setEpPickerOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEpPickerOpen(false)}>
          <Pressable style={styles.picker} onPress={() => {}}>
            <Text variant="h2" color={colors.light.devilInk} style={styles.pickerTitle}>회차 선택</Text>
            <ScrollView style={styles.pickerList} showsVerticalScrollIndicator={false}>
              {EPISODES.map((n) => {
                const on = n === ep;
                const last = n === LAST_EP;
                return (
                  <Pressable key={n} style={[styles.pickerItem, on && styles.pickerItemOn]} onPress={() => selectEp(n)}>
                    <Text variant="bodyBold" color={on ? colors.light.devilBlue : colors.light.devilInk}>
                      {n}화{last ? ' · 최종 우승자' : ''}
                    </Text>
                    {on ? <Text variant="bodyBold" color={colors.light.devilBlue}>✓</Text> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', backgroundColor: colors.light.devilBlueWash, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4, marginBottom: space.sm },
  badgeText: { fontSize: 11, lineHeight: 15 },
  sub: { marginTop: space.xs },
  label: { marginTop: space.xl, marginBottom: space.sm },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.light.hairline, borderRadius: radius.card, paddingHorizontal: space.lg, height: 52 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg },
  cell: { width: '22%', alignItems: 'center' },
  avatarWrap: { width: '100%', aspectRatio: 1, borderRadius: 999, borderWidth: 3, borderColor: 'transparent', overflow: 'hidden', backgroundColor: colors.light.devilCellBg },
  avatarOn: { borderColor: colors.light.devilBlue },
  avatarWin: { borderColor: colors.light.devilAmber },
  avatar: { width: '100%', height: '100%' },
  doneOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,20,31,0.48)' },
  check: { position: 'absolute', right: '12%', top: -2, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.light.devilBlue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.light.paper },
  checkWin: { backgroundColor: colors.light.devilAmber },
  checkMark: { fontSize: 12, lineHeight: 15 },
  name: { marginTop: space.sm, maxWidth: '100%' },
  doneTag: { fontSize: 10 },
  cta: { marginTop: space.section, borderRadius: radius.pill, backgroundColor: colors.light.devilBlue },
  ctaWin: { backgroundColor: colors.light.devilAmber },
  backdrop: { flex: 1, backgroundColor: 'rgba(8,10,18,0.45)', justifyContent: 'center', paddingHorizontal: space.xl },
  picker: { backgroundColor: colors.light.paper, borderRadius: radius.hero, padding: space.lg, maxHeight: '70%' },
  pickerTitle: { textAlign: 'center', marginBottom: space.md },
  pickerList: { flexGrow: 0 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.card },
  pickerItemOn: { backgroundColor: colors.light.devilBlueWash },
});
