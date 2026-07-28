/**
 * S1. 표지/홈 — 브랜드 헤더 + 다음 모임(다음 달) 담당자·확정 날짜 + 아이디어 창고.
 * 담당자는 관리자가 지정하고, 모임 날짜는 투표로 확정되면 여기 표시된다(마이페이지 투표).
 */
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { HostPickerModal } from '@/features/host/HostPickerModal';
import { MemoBoard } from '@/features/memo/MemoBoard';
import { ConfirmDateModal } from '@/features/vote/ConfirmDateModal';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { addMonths, dday, formatKo, todayStr, volLabel } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { getHost, setHost } from '@/api/hosts';
import { getPoll, setConfirmedDate } from '@/api/polls';

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [pickHost, setPickHost] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const today = todayStr();
  const nextMonth = addMonths(today, 1);
  const nMonth = Number(nextMonth.slice(5, 7));
  const nYear = Number(nextMonth.slice(0, 4));

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

  // 담당자 표시는 members(=마이페이지에서 방금 바꾼 값)를 우선한다.
  // hosts 조인 스냅샷만 믿으면 프사·닉네임 변경이 이 카드에 늦게 반영된다.
  const hostMember = members.find((m) => m.id === host?.member_id);
  const hostName = hostMember?.nickname ?? host?.nickname ?? '';
  const hostAvatar = hostMember?.avatar_url ?? host?.avatar_url ?? null;
  const hostColor = hostMember?.color ?? host?.color ?? null;

  const isAdmin = !!me?.is_admin;
  const confirmed = poll?.confirmed_date ?? null;
  const canFix = host?.member_id === userId || isAdmin;
  const dleft = confirmed ? dday(confirmed) : null;
  const ddayLabel = dleft == null ? '미정' : dleft > 0 ? `D-${dleft}` : dleft === 0 ? 'D-DAY' : `D+${-dleft}`;

  return (
    <Screen scroll>
      <BrandHeader />
      <Text variant="kicker" color={colors.light.textSecondary}>{volLabel(today)}</Text>

      {/* 다음 모임 담당자 */}
      <View style={styles.hostCard}>
        <View style={{ flex: 1 }}>
          <Text variant="kicker" color={colors.light.textSecondary}>{nMonth}월 모임 담당자</Text>
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

      {/* 히어로 — 다음 모임 날짜 */}
      <View style={styles.hero}>
        <View style={styles.heroDeco} />
        <View style={styles.heroTop}>
          <View style={styles.chip}><Text variant="kicker" color={colors.light.paper}>◆ 다음 모임</Text></View>
          <Text variant="mono" color={colors.light.paper60}>{volLabel(nextMonth)}</Text>
        </View>
        <Text style={styles.heroBig}>{ddayLabel}</Text>
        <Text variant="body" color={colors.light.paper} style={{ marginTop: space.xs }}>
          {confirmed ? `${formatKo(confirmed)} 모임` : `${nMonth}월 모임 날짜 미정`}
        </Text>
        <Button label="달력에서 내 일정 입력" block onPress={() => router.push('/calendar')} style={{ marginTop: space.lg }} />
        {canFix ? (
          <Button label={confirmed ? '날짜 변경' : '날짜 확정하기'} variant="ghost" block onPress={() => setConfirmOpen(true)} />
        ) : null}
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
        saving={confirmMut.isPending}
        onClose={() => setConfirmOpen(false)}
        onSubmit={(date) => confirmMut.mutate(date)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.surfacePlate, borderRadius: radius.soft, padding: 16, marginTop: space.md, marginBottom: space.lg },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  hostAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  hostBtn: { height: 40, paddingHorizontal: space.lg },

  hero: { backgroundColor: colors.light.heroBg, borderRadius: radius.hero, padding: 22, overflow: 'hidden' },
  heroDeco: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.light.cobalt22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { backgroundColor: colors.light.cobalt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  heroBig: { fontFamily: fonts.display, fontSize: 44, lineHeight: 54, letterSpacing: -1, color: colors.light.paper, marginTop: space.md },
});
