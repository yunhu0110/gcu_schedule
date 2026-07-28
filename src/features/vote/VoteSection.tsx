/**
 * VoteSection — 마이페이지에 들어가는 날짜 투표 섹션.
 * 담당자: 투표 시작 + 최종 날짜 확정. 멤버: 가능한 날에 투표. 모두: 현황(득표) 확인.
 * 이벤트마다 다른 멤버에게 알림을 fan-out 한다.
 */
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { StartPollModal } from './StartPollModal';
import { colors, radius, space } from '@/theme/tokens';
import { formatKo, type DateStr } from '@/lib/date';
import { castVote, confirmDate, createPoll, getPoll } from '@/api/polls';
import { notifyMembers } from '@/api/notifications';

type Props = {
  userId: string;
  meNickname: string;
  isHost: boolean;
  year: number;
  month: number;
  memberIds: string[];
};

export function VoteSection({ userId, meNickname, isHost, year, month, memberIds }: Props) {
  const qc = useQueryClient();
  const [startOpen, setStartOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: poll } = useQuery({ queryKey: ['poll', year, month], queryFn: () => getPoll(year, month), enabled: !!userId });

  useEffect(() => {
    if (poll) setSelected(new Set(poll.options.filter((o) => o.voters.some((v) => v.member_id === userId)).map((o) => o.id)));
  }, [poll, userId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['poll', year, month] });
    qc.invalidateQueries({ queryKey: ['next-meeting'] });
  };
  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  const createMut = useMutation({
    mutationFn: async (v: { dates: DateStr[]; deadline: DateStr }) => {
      await createPoll(userId, year, month, v.dates, v.deadline);
      await notifyMembers(userId, memberIds, 'vote_started', `${meNickname}님이 ${month}월 날짜 투표를 시작했어요.`);
    },
    onSuccess: () => { refresh(); setStartOpen(false); },
    onError: onErr,
  });

  const voteMut = useMutation({
    mutationFn: async () => {
      if (!poll) return;
      await castVote(userId, poll.options.map((o) => o.id), [...selected]);
      await notifyMembers(userId, memberIds, 'vote_cast', `${meNickname}님이 투표했어요.`);
    },
    onSuccess: refresh,
    onError: onErr,
  });

  const confirmMut = useMutation({
    mutationFn: async (opt: { id: string; date: DateStr }) => {
      if (!poll) return;
      await confirmDate(poll.id, opt.date);
      await notifyMembers(userId, memberIds, 'date_confirmed', `${month}월 모임 날짜가 ${formatKo(opt.date)}로 확정됐어요.`);
    },
    onSuccess: refresh,
    onError: onErr,
  });

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  }

  // 투표 없음
  if (!poll) {
    return (
      <View style={styles.box}>
        {isHost ? (
          <>
            <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginBottom: space.md }}>
              담당자로서 이 달 날짜 투표를 시작할 수 있어요.
            </Text>
            <Button label="날짜 투표 시작" block onPress={() => setStartOpen(true)} />
          </>
        ) : (
          <Text variant="bodySm" color={colors.light.textSecondary}>아직 진행 중인 투표가 없어요.</Text>
        )}
        <StartPollModal visible={startOpen} year={year} month={month} saving={createMut.isPending} onClose={() => setStartOpen(false)} onSubmit={(dates, deadline) => createMut.mutate({ dates, deadline })} />
      </View>
    );
  }

  // 확정됨
  if (poll.confirmed_date) {
    return (
      <View style={styles.box}>
        <Text variant="bodyBold" color={colors.light.action}>✅ {formatKo(poll.confirmed_date)}로 확정</Text>
      </View>
    );
  }

  // 진행 중
  return (
    <View style={styles.box}>
      {poll.deadline ? (
        <Text variant="caption" color={colors.light.textSecondary} style={{ marginBottom: space.sm }}>
          기한 · {formatKo(poll.deadline)}까지
        </Text>
      ) : null}
      {poll.options.map((o) => {
        const on = selected.has(o.id);
        return (
          <View key={o.id} style={styles.optRow}>
            <Pressable style={styles.optLeft} onPress={() => toggle(o.id)}>
              <View style={[styles.check, on && styles.checkOn]}>{on ? <Text variant="caption" color={colors.light.paper}>✓</Text> : null}</View>
              <Text variant="bodyBold" style={{ fontSize: 14 }}>{formatKo(o.date)}</Text>
            </Pressable>
            <View style={styles.optRight}>
              <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 12 }}>{o.voters.length}표</Text>
              {isHost ? (
                <Pressable onPress={() => confirmMut.mutate({ id: o.id, date: o.date })} hitSlop={8}>
                  <Text variant="caption" color={colors.light.cobalt}>확정</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
      <Button label={voteMut.isPending ? '저장 중…' : '내 투표 저장'} block loading={voteMut.isPending} onPress={() => voteMut.mutate()} style={{ marginTop: space.md }} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {},
  optRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.light.hairline },
  optLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flex: 1 },
  optRight: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.light.hairlineStrong, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.light.cobalt, borderColor: colors.light.cobalt },
});
