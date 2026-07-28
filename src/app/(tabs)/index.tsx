/**
 * S1. 표지/홈 — 브랜드 헤더 + 다음 모임(다음 달) 담당자·확정 날짜 + 아이디어 창고.
 * 담당자는 관리자가 지정하고, 모임 날짜는 투표로 확정되면 여기 표시된다(마이페이지 투표).
 */
import { useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { BrandHeader } from '@/components/BrandHeader';
import { HostPickerModal } from '@/features/host/HostPickerModal';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { addMonths, formatKo, todayStr, volLabel } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { getHost, setHost } from '@/api/hosts';
import { getPoll } from '@/api/polls';
import { addIdea, listIdeas } from '@/api/ideas';
import { notifyMembers } from '@/api/notifications';

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [pickHost, setPickHost] = useState(false);
  const [idea, setIdea] = useState('');

  const today = todayStr();
  const nextMonth = addMonths(today, 1);
  const nMonth = Number(nextMonth.slice(5, 7));
  const nYear = Number(nextMonth.slice(0, 4));

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: host } = useQuery({ queryKey: ['host', nYear, nMonth], queryFn: () => getHost(nYear, nMonth), enabled: !!userId });
  const { data: poll } = useQuery({ queryKey: ['next-meeting', nYear, nMonth], queryFn: () => getPoll(nYear, nMonth), enabled: !!userId });
  const { data: ideas = [] } = useQuery({ queryKey: ['ideas'], queryFn: listIdeas, enabled: !!userId });

  const hostMut = useMutation({
    mutationFn: (memberId: string) => setHost(nYear, nMonth, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['host', nYear, nMonth] }); setPickHost(false); },
  });

  const ideaMut = useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error('로그인이 필요해요.');
      await addIdea(userId, body);
      const nick = me?.nickname ?? '멤버';
      await notifyMembers(userId, members.map((m) => m.id), 'idea_added', `${nick}님이 아이디어를 추가했어요: ${body.trim()}`);
    },
    onSuccess: () => { setIdea(''); qc.invalidateQueries({ queryKey: ['ideas'] }); qc.invalidateQueries({ queryKey: ['unread'] }); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const isAdmin = !!me?.is_admin;
  const confirmed = poll?.confirmed_date ?? null;

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

      {/* 히어로 — 다음 모임 날짜 */}
      <View style={styles.hero}>
        <View style={styles.heroDeco} />
        <View style={styles.heroTop}>
          <View style={styles.chip}><Text variant="kicker" color={colors.light.paper}>◆ 다음 모임</Text></View>
          <Text variant="mono" color={colors.light.paper60}>{volLabel(nextMonth)}</Text>
        </View>
        <Text style={styles.heroBig}>{confirmed ? formatKo(confirmed) : '미정'}</Text>
        <Text variant="bodySm" color={colors.light.paper60} style={{ marginTop: space.xs }}>
          {confirmed ? `${nMonth}월 모임 날짜가 확정됐어요.` : `${nMonth}월 날짜를 투표로 정해요. 달력에서 가능한 날을 먼저 입력!`}
        </Text>
        <Button label="달력에서 내 일정 입력" block onPress={() => router.push('/calendar')} style={{ marginTop: space.lg }} />
      </View>

      {/* 아이디어 창고 */}
      <View style={styles.ideaCard}>
        <View style={styles.ideaHead}>
          <Text style={styles.ideaEmoji}>💡</Text>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold" style={{ fontSize: 16 }}>아이디어 창고</Text>
            <Text variant="caption" color={colors.light.textSecondary}>가보고 싶은 곳 · 하고 싶은 것</Text>
          </View>
        </View>

        {ideas.length === 0 ? (
          <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.md }}>첫 아이디어를 남겨보세요.</Text>
        ) : (
          <View style={styles.ideaChips}>
            {ideas.map((it) => (
              <View key={it.id} style={styles.ideaChip}>
                <View style={[styles.ideaDot, { backgroundColor: it.color ?? colors.light.cobalt }]} />
                <Text variant="bodySm">{it.body}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.ideaInput}>
          <TextField value={idea} onChangeText={setIdea} placeholder="아이디어 추가" style={{ flex: 1 }} />
          <Button label="추가" onPress={() => idea.trim() && ideaMut.mutate(idea)} loading={ideaMut.isPending} style={styles.ideaBtn} />
        </View>
      </View>

      <HostPickerModal
        visible={pickHost}
        monthLabel={`${nMonth}월`}
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
  hostCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.light.surfacePlate, borderRadius: radius.soft, padding: 16, marginTop: space.md, marginBottom: space.lg },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 6 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hostBtn: { height: 40, paddingHorizontal: space.lg },

  hero: { backgroundColor: colors.light.heroBg, borderRadius: radius.hero, padding: 22, overflow: 'hidden' },
  heroDeco: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.light.cobalt22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { backgroundColor: colors.light.cobalt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  heroBig: { fontFamily: fonts.display, fontSize: 44, lineHeight: 54, letterSpacing: -1, color: colors.light.paper, marginTop: space.md },

  ideaCard: { backgroundColor: colors.light.surfacePlate, borderRadius: radius.soft, padding: 18, marginTop: space.xl },
  ideaHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ideaEmoji: { fontSize: 26 },
  ideaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  ideaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.light.paper, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  ideaInput: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  ideaBtn: { height: 48, paddingHorizontal: space.lg },
  ideaDot: { width: 8, height: 8, borderRadius: 4 },
});
