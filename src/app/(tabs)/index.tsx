/**
 * S1. 표지/홈 — 브랜드 헤더 + 모임(기본: 다음 달) 모임장·확정 날짜 + 낙서장.
 * 모임장은 관리자가 지정하고, 모임 날짜는 투표로 확정되면 여기 표시된다(마이페이지 투표).
 * 히어로는 좌우 스와이프(또는 ‹ › 탭)로 이전/다음 달 모임을 넘겨 볼 수 있다.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { HostPickerModal } from '@/features/host/HostPickerModal';
import { MemoBoard } from '@/features/memo/MemoBoard';
import { ConfirmDateModal } from '@/features/vote/ConfirmDateModal';
import { colors, fonts, radius, shadow, space } from '@/theme/tokens';
import { addMonths, dday, formatKo, todayStr, volLabel } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { getHost, setHost } from '@/api/hosts';
import { clearConfirmedDate, getPoll, setConfirmedDate } from '@/api/polls';

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [pickHost, setPickHost] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // 히어로가 보고 있는 달. 0 = 이번 달, 1 = 다음 달(기본). 스와이프로 이동.
  const [offset, setOffset] = useState(1);
  const [dir, setDir] = useState(1); // 넘김 방향(1=다음, -1=이전) — 슬라이드 애니메이션 방향

  const today = todayStr();
  const shownMonth = addMonths(today, offset);
  const nMonth = Number(shownMonth.slice(5, 7));
  const nYear = Number(shownMonth.slice(0, 4));

  const step = (d: number) => setOffset((v) => {
    const next = Math.min(12, Math.max(-11, v + d));
    if (next !== v) setDir(d);
    return next;
  });
  const heroAnim = (dir > 0 ? FadeInRight : FadeInLeft).duration(240);
  // 좌우로 충분히 끌었을 때만 발동 — 세로 스크롤과 충돌하지 않게 activeOffsetX로 축을 고정.
  const swipe = Gesture.Pan()
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd((e) => {
      if (e.translationX <= -40) step(1);
      else if (e.translationX >= 40) step(-1);
    });

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: host } = useQuery({ queryKey: ['host', nYear, nMonth], queryFn: () => getHost(nYear, nMonth), enabled: !!userId });
  const { data: poll } = useQuery({ queryKey: ['next-meeting', nYear, nMonth], queryFn: () => getPoll(nYear, nMonth), enabled: !!userId });

  const hostMut = useMutation({
    mutationFn: (memberId: string) => setHost(nYear, nMonth, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['host', nYear, nMonth] }); setPickHost(false); },
  });

  const confirmMut = useMutation({
    mutationFn: (date: string) => setConfirmedDate(userId as string, nYear, nMonth, date),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-meeting', nYear, nMonth] }); setConfirmOpen(false); },
  });

  const clearMut = useMutation({
    mutationFn: () => clearConfirmedDate(nYear, nMonth),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['next-meeting', nYear, nMonth] }); setConfirmOpen(false); },
    onError: (e) => Alert.alert('초기화 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.'),
  });

  const isAdmin = !!me?.is_admin;
  const confirmed = poll?.confirmed_date ?? null;
  const canFix = host?.member_id === userId || isAdmin;
  const dleft = confirmed ? dday(confirmed) : null;
  const ddayLabel = dleft == null ? '미정' : dleft > 0 ? `D-${dleft}` : dleft === 0 ? 'D-DAY' : `D+${-dleft}`;

  return (
    <Screen scroll backgroundColor={colors.light.renewBg}>
      <BrandHeader />

      {/* 히어로 — 모임 날짜 (좌우 스와이프로 달 이동) */}
      <GestureDetector gesture={swipe}>
        <View style={styles.hero}>
          <View style={styles.heroDeco} />
          <View style={styles.heroTop}>
            <Animated.View key={offset} entering={heroAnim} style={styles.chip}>
              <Text variant="caption" color={colors.light.paper}>{offset === 1 ? '다음 모임' : `${nMonth}월 모임`}</Text>
            </Animated.View>
            <View style={styles.heroNav}>
              <Pressable onPress={() => step(-1)} hitSlop={12}><Text variant="h2" color={colors.light.paper60}>‹</Text></Pressable>
              <Text variant="mono" color={colors.light.paper60}>{volLabel(shownMonth)}</Text>
              <Pressable onPress={() => step(1)} hitSlop={12}><Text variant="h2" color={colors.light.paper60}>›</Text></Pressable>
            </View>
          </View>

          <Animated.View key={`body-${offset}`} entering={heroAnim} style={styles.heroBody}>
            <View style={{ flex: 1 }}>
              {confirmed ? (
                <>
                  <Text style={styles.heroBig}>{ddayLabel}</Text>
                  <Text variant="bodyBold" color={colors.light.paper} style={{ marginTop: space.xs }}>{formatKo(confirmed)} 모임</Text>
                </>
              ) : (
                <Text style={styles.heroTitle}>{nMonth}월 모임{'\n'}날짜 미정</Text>
              )}
              <Pressable onPress={() => router.push('/calendar')} hitSlop={8}>
                <Text variant="bodyBold" color={colors.light.paper} style={styles.heroLink}>달력에서 내 일정 입력하기</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => router.push('/calendar')} style={styles.heroCircle} hitSlop={8}>
              <Text style={styles.heroArrow}>→</Text>
            </Pressable>
          </Animated.View>

          {canFix ? (
            <Button label={confirmed ? '날짜 변경' : '날짜 확정하기'} variant="ghost" block color={colors.light.paper} onPress={() => setConfirmOpen(true)} style={styles.heroFix} />
          ) : null}
        </View>
      </GestureDetector>

      {/* 모임장 */}
      <View style={styles.hostCard}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" color={colors.light.textSecondary}>{nMonth}월 모임장</Text>
          {host ? (
            <View style={styles.hostRow}>
              {host.avatar_url ? (
                <Image source={{ uri: host.avatar_url }} style={styles.hostAvatar} />
              ) : (
                <View style={[styles.hostAvatar, { backgroundColor: host.color ?? colors.light.mist }]}>
                  <Text variant="caption" color={colors.light.paper}>{host.nickname.slice(0, 1)}</Text>
                </View>
              )}
              <Text variant="bodyBold" style={{ fontSize: 16 }}>{host.nickname}</Text>
            </View>
          ) : (
            <Text variant="bodyBold" style={{ fontSize: 16, marginTop: 4 }} color={colors.light.textSecondary}>아직 미정</Text>
          )}
        </View>
        {isAdmin ? <Button label={host ? '변경' : '지정'} variant="secondary" onPress={() => setPickHost(true)} style={styles.hostBtn} /> : null}
      </View>

      {/* 메모장 */}
      {userId ? <MemoBoard userId={userId} /> : null}

      <HostPickerModal
        visible={pickHost}
        monthLabel={`${nMonth}월`}
        members={members}
        currentId={host?.member_id}
        saving={hostMut.isPending}
        onClose={() => setPickHost(false)}
        onSelect={(id) => hostMut.mutate(id)}
      />
      <ConfirmDateModal
        visible={confirmOpen}
        year={nYear}
        month={nMonth}
        confirmed={confirmed}
        saving={confirmMut.isPending}
        clearing={clearMut.isPending}
        onClose={() => setConfirmOpen(false)}
        onSubmit={(date) => confirmMut.mutate(date)}
        onClear={() => clearMut.mutate()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.paper, borderRadius: radius.soft, padding: space.lg, marginTop: space.lg, ...shadow.soft },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hostBtn: { height: 40, paddingHorizontal: space.lg },

  hero: { backgroundColor: colors.light.renewPrimary, borderRadius: radius.hero, padding: 22, overflow: 'hidden', ...shadow.hero },
  heroDeco: { position: 'absolute', right: -40, top: -20, width: 180, height: 180, borderRadius: 90, backgroundColor: colors.light.renewBright, opacity: 0.35 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroNav: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  chip: { backgroundColor: colors.light.paper16, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  heroBody: { flexDirection: 'row', alignItems: 'flex-end', marginTop: space.lg },
  heroTitle: { fontFamily: fonts.brand, fontSize: 26, lineHeight: 34, letterSpacing: -0.5, color: colors.light.paper },
  heroBig: { fontFamily: fonts.display, fontSize: 44, lineHeight: 54, letterSpacing: -1, color: colors.light.paper },
  heroLink: { marginTop: space.md, textDecorationLine: 'underline' },
  heroCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.light.paper, alignItems: 'center', justifyContent: 'center', marginLeft: space.md },
  heroArrow: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 26, color: colors.light.renewPrimary },
  heroFix: { marginTop: space.lg, borderWidth: 1, borderColor: colors.light.paper60 },
});
