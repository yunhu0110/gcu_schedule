/**
 * S1. 표지/홈 — 브랜드 헤더 + 월별 모임(담당자·확정 날짜) + 메모장.
 * 히어로는 달 단위 페이지라 좌우로 넘기면 지난 달·다음 달 모임 일자를 보고 고칠 수 있다.
 * 기본은 다음 달(=다음 모임). 담당자 지정은 관리자, 날짜 확정·초기화는 그 달 모임장 본인만.
 */
import { useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { HostPickerModal } from '@/features/host/HostPickerModal';
import { MonthHero } from '@/features/host/MonthHero';
import { MemoBoard } from '@/features/memo/MemoBoard';
import { ConfirmDateModal } from '@/features/vote/ConfirmDateModal';
import { colors, radius, space } from '@/theme/tokens';
import { addMonths, todayStr } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { listMonthlyPosts, setHost } from '@/api/hosts';
import { clearConfirmedDate, listPolls, setConfirmedDate } from '@/api/polls';

// 히어로에서 넘겨볼 수 있는 범위 — 지난 6개월 ~ 다음 3개월.
const BACK = 6;
const FWD = 3;

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const pageW = Math.max(240, width - space.screen * 2);

  const [pickHost, setPickHost] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = todayStr();
  const months = useMemo(() => Array.from({ length: BACK + FWD + 1 }, (_, i) => addMonths(today, i - BACK)), [today]);
  const nextIndex = BACK + 1; // 기본 페이지 = 다음 달
  const [index, setIndex] = useState(nextIndex);

  const sel = months[index] ?? months[nextIndex];
  const selY = Number(sel.slice(0, 4));
  const selM = Number(sel.slice(5, 7));

  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);
  // 넘기는 동안 카드가 작아졌다 커지는 효과(MonthHero에서 보간).
  const scrollX = useRef(new Animated.Value(nextIndex * pageW)).current;

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  // 달을 넘겨도 바로 그려지도록 담당자·확정 날짜는 월별로 나눠 받지 않고 한 번에 받는다(행 수가 적다).
  const { data: hosts = [] } = useQuery({ queryKey: ['hosts-all'], queryFn: listMonthlyPosts, enabled: !!userId });
  const { data: polls = [] } = useQuery({ queryKey: ['polls-all'], queryFn: listPolls, enabled: !!userId });

  const hostOf = (m: string) => hosts.find((h) => h.year === Number(m.slice(0, 4)) && h.month === Number(m.slice(5, 7))) ?? null;
  const confirmedOf = (m: string) => polls.find((p) => p.year === Number(m.slice(0, 4)) && p.month === Number(m.slice(5, 7)))?.confirmed_date ?? null;

  const isAdmin = !!me?.is_admin;
  // 날짜 확정·변경은 그 달 모임장 본인만. (담당자 지정은 여전히 관리자)
  const canFixOf = (m: string) => !!userId && hostOf(m)?.member_id === userId;

  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['hosts-all'] });
    qc.invalidateQueries({ queryKey: ['polls-all'] });
    qc.invalidateQueries({ queryKey: ['host'] });
    qc.invalidateQueries({ queryKey: ['next-meeting'] });
    qc.invalidateQueries({ queryKey: ['poll'] });
  };

  const hostMut = useMutation({
    mutationFn: (memberId: string) => setHost(selY, selM, memberId),
    onSuccess: () => { refresh(); setPickHost(false); },
    onError: onErr,
  });

  const confirmMut = useMutation({
    mutationFn: (date: string) => setConfirmedDate(userId as string, selY, selM, date),
    onSuccess: () => { refresh(); setConfirmOpen(false); },
    onError: onErr,
  });

  const clearMut = useMutation({
    mutationFn: () => clearConfirmedDate(selY, selM),
    onSuccess: () => { refresh(); setConfirmOpen(false); },
    onError: onErr,
  });

  // 담당자 표시는 members(=마이페이지에서 방금 바꾼 값)를 우선한다.
  const host = hostOf(sel);
  const hostMember = members.find((m) => m.id === host?.member_id);
  const hostName = hostMember?.nickname ?? host?.nickname ?? '';
  const hostAvatar = hostMember?.avatar_url ?? host?.avatar_url ?? null;
  const hostColor = hostMember?.color ?? host?.color ?? null;

  function onPageEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (i !== index) setIndex(Math.max(0, Math.min(months.length - 1, i)));
  }

  return (
    <Screen scroll>
      <BrandHeader />

      {/* 그 달 담당자 */}
      <View style={styles.hostCard}>
        <View style={{ flex: 1 }}>
          <Text variant="kicker" color={colors.light.textSecondary}>{selM}월 모임 담당자</Text>
          {host ? (
            <View style={styles.hostRow}>
              {hostAvatar ? (
                <Image source={{ uri: hostAvatar }} style={styles.hostAvatar} />
              ) : (
                <View style={[styles.hostAvatar, { backgroundColor: hostColor ?? colors.light.mist }]}>
                  <Text variant="bodyBold" color={colors.light.paper}>{(hostName || '?').slice(0, 1)}</Text>
                </View>
              )}
              <Text variant="bodyBold" style={{ fontSize: 17 }}>{hostName}</Text>
            </View>
          ) : (
            <Text variant="bodyBold" style={{ fontSize: 16, marginTop: 4 }} color={colors.light.textSecondary}>아직 미정</Text>
          )}
        </View>
        {isAdmin ? <Button label={host ? '변경' : '지정'} variant="secondary" onPress={() => setPickHost(true)} style={styles.hostBtn} /> : null}
      </View>

      {/* 히어로 — 좌우로 넘겨 달 이동 */}
      <Animated.ScrollView
        ref={scrollRef as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
        onMomentumScrollEnd={onPageEnd}
        onLayout={() => {
          if (placed.current) return;
          placed.current = true;
          scrollRef.current?.scrollTo({ x: nextIndex * pageW, animated: false });
        }}
      >
        {months.map((m, i) => (
          <MonthHero
            key={m}
            month={m}
            width={pageW}
            pageIndex={i}
            scrollX={scrollX}
            confirmed={confirmedOf(m)}
            canFix={canFixOf(m)}
            onOpenCalendar={() => router.push('/calendar')}
            onEditDate={() => setConfirmOpen(true)}
          />
        ))}
      </Animated.ScrollView>
      <Text variant="caption" color={colors.light.textSecondary} style={styles.hint}>
        ← 옆으로 넘기면 다른 달 모임 일자 →
      </Text>

      {/* 메모장 */}
      {userId ? <MemoBoard userId={userId} /> : null}

      <HostPickerModal
        visible={pickHost}
        monthLabel={`${selM}월`}
        members={members}
        currentId={host?.member_id}
        saving={hostMut.isPending}
        onClose={() => setPickHost(false)}
        onSelect={(id) => hostMut.mutate(id)}
      />
      <ConfirmDateModal
        visible={confirmOpen}
        year={selY}
        month={selM}
        confirmed={confirmedOf(sel)}
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
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.surfacePlate, borderRadius: radius.soft, padding: 16, marginTop: space.md, marginBottom: space.lg },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  hostAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hostBtn: { height: 40, paddingHorizontal: space.lg },
  hint: { textAlign: 'center', marginTop: space.sm },
});
