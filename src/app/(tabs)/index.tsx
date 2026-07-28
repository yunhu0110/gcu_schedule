/**
 * S1. 표지/홈 — 브랜드 표지 + 이 달의 담당자 + 다음 모임 상태 + 일정 입력 유도.
 * 담당자(모임장)는 매월 다르며, 관리자가 지정한다(hosts). 다음 모임은 데이터 전이라 "미정".
 */
import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { HostPickerModal } from '@/features/host/HostPickerModal';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { addMonths, todayStr, volLabel } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { getHost, setHost } from '@/api/hosts';

const RECENT = [
  { title: '7월 모임 기록', ago: '어제' },
  { title: '가고 싶은 곳 후보', ago: '3일 전' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [pickHost, setPickHost] = useState(false);

  const today = todayStr();
  const nextMonth = addMonths(today, 1);
  const nextMonthNum = Number(nextMonth.slice(5, 7));
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: host } = useQuery({ queryKey: ['host', year, month], queryFn: () => getHost(year, month), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });

  const hostMut = useMutation({
    mutationFn: (memberId: string) => setHost(year, month, memberId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['host', year, month] });
      setPickHost(false);
    },
  });

  const isAdmin = !!me?.is_admin;

  return (
    <Screen scroll>
      {/* 브랜드 헤더 (로고 왼쪽 + 월간gcu) */}
      <View style={styles.brandRow}>
        <View style={styles.brandLeft}>
          <Logo height={22} />
          <Text variant="brand">월간gcu</Text>
        </View>
        <Text variant="kicker" color={colors.light.textSecondary}>
          {volLabel(today)}
        </Text>
      </View>

      {/* 이 달의 담당자 */}
      <View style={styles.hostCard}>
        <View style={{ flex: 1 }}>
          <Text variant="kicker" color={colors.light.textSecondary}>
            {month}월 담당자
          </Text>
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
            <Text variant="bodyBold" style={{ fontSize: 16, marginTop: 4 }} color={colors.light.textSecondary}>
              아직 미정
            </Text>
          )}
        </View>
        {isAdmin ? (
          <Button label={host ? '변경' : '지정'} variant="secondary" onPress={() => setPickHost(true)} style={styles.hostBtn} />
        ) : null}
      </View>

      {/* 히어로 — 다음 모임 미정 */}
      <View style={styles.hero}>
        <View style={styles.heroDeco} />
        <View style={styles.heroTop}>
          <View style={styles.chip}>
            <Text variant="kicker" color={colors.light.paper}>◆ 다음 모임</Text>
          </View>
          <Text variant="mono" color={colors.light.paper60}>{volLabel(nextMonth)}</Text>
        </View>

        <Text style={styles.heroBig}>미정</Text>

        <Text variant="body" color={colors.light.paper} style={{ marginTop: space.xs }}>
          {nextMonthNum}월 모임 일정을 모으는 중이에요.
        </Text>
        <Text variant="bodySm" color={colors.light.paper60} style={{ marginTop: space.xs }}>
          달력에서 각자 가능한 날을 입력하면 후보가 잡혀요.
        </Text>

        <Button label="달력에서 내 일정 입력" block onPress={() => router.push('/calendar')} style={{ marginTop: space.lg }} />
      </View>

      {/* 최근 문서 */}
      <View style={styles.recent}>
        <Text variant="kicker" color={colors.light.textSecondary}>Recent</Text>
        {RECENT.map((r) => (
          <View key={r.title} style={styles.recentRow}>
            <View style={styles.recentDot} />
            <Text variant="bodySm" style={{ flex: 1 }} onPress={() => router.push('/wiki')}>{r.title}</Text>
            <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 10 }}>{r.ago}</Text>
          </View>
        ))}
      </View>

      <HostPickerModal
        visible={pickHost}
        monthLabel={`${month}월`}
        members={members}
        currentId={host?.member_id}
        saving={hostMut.isPending}
        onClose={() => setPickHost(false)}
        onSelect={(id) => hostMut.mutate(id)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: space.lg },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.light.surfacePlate,
    borderRadius: radius.soft,
    padding: 16,
    marginBottom: space.lg,
  },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hostBtn: { height: 40, paddingHorizontal: space.lg },

  hero: { backgroundColor: colors.light.heroBg, borderRadius: radius.hero, padding: 22, overflow: 'hidden' },
  heroDeco: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.light.cobalt22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { backgroundColor: colors.light.cobalt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  heroBig: { fontFamily: fonts.display, fontSize: 56, lineHeight: 66, letterSpacing: -1, color: colors.light.paper, marginTop: space.md },

  recent: { marginTop: space.xl, gap: space.xs },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 11 },
  recentDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.light.cobalt },
});
