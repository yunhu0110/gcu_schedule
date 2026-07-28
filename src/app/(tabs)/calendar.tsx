/**
 * S2. 달력 — 6칸 게이지 월 그리드 + 날짜 상세(누가 가능/불가) + 하단 "가능한 날" 후보.
 * 날짜 탭 → 상세 팝업(가능/불가/미입력 · 시간), 거기서 내 일정 입력/수정.
 * 하단엔 이번 달 후보(불가 0명 & 가능 1명 이상)를 멤버·시간과 함께 보여준다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { BrandHeader } from '@/components/BrandHeader';
import { GaugeCell, type DayCounts } from '@/components/GaugeCell';
import { AvailabilityModal, type AvailabilitySubmit } from '@/features/availability/AvailabilityModal';
import { DayDetailModal } from '@/features/availability/DayDetailModal';
import { colors, space } from '@/theme/tokens';
import { addMonths, endOfMonth, formatKo, monthGrid, startOfMonth, todayStr, volLabel } from '@/lib/date';
import { getMonthRows, getSummary, setRange, type AvailRow } from '@/api/availabilities';
import { listMembers } from '@/api/members';
import { notifyMembers } from '@/api/notifications';
import { useAuth } from '@/features/auth/AuthContext';
import { useDevStore } from '@/store/devStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY: DayCounts = { available: 0, maybe: 0, unavailable: 0, missing: 0 };
const fmtTime = (s: string | null) => (s ? s.slice(0, 5) : null);
const timeLabel = (r: AvailRow) => {
  const a = fmtTime(r.start_time);
  const b = fmtTime(r.end_time);
  return a && b ? `${a}–${b}` : '종일';
};

function placeholderCounts(date: string): DayCounts {
  const n = [...date].reduce((a, c) => a + c.charCodeAt(0), 0);
  const available = n % 7;
  let remaining = 6 - available;
  const unavailable = remaining >= 2 && n % 4 === 0 ? 1 : 0;
  remaining -= unavailable;
  const maybe = remaining >= 1 && n % 5 === 0 ? 1 : 0;
  const missing = 6 - available - unavailable - maybe;
  return { available, maybe, unavailable, missing };
}

export default function CalendarScreen() {
  const { userId } = useAuth();
  const preview = useDevStore((s) => s.previewMode);
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState(todayStr());
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);

  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  const cells = monthGrid(anchor);

  const { data: summary } = useQuery({
    queryKey: ['availability-summary', from, to],
    queryFn: () => getSummary(from, to),
    enabled: !!userId,
  });
  const { data: rows = [] } = useQuery({
    queryKey: ['availability-rows', from, to],
    queryFn: () => getMonthRows(from, to),
    enabled: !!userId,
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: listMembers,
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (v: AvailabilitySubmit) => {
      if (!userId) throw new Error('로그인이 필요해요.');
      await setRange(userId, v.from, v.to, v.status, v.note, v.startTime, v.endTime);
      const nick = members.find((m) => m.id === userId)?.nickname ?? '멤버';
      const label = v.status === 'available' ? '가능' : '불가';
      await notifyMembers(userId, members.map((m) => m.id), 'availability_set', `${nick}님이 ${formatKo(v.from)} 일정(${label})을 등록했어요.`, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability-summary'] });
      qc.invalidateQueries({ queryKey: ['availability-rows'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
      setEditDate(null);
    },
    onError: (e) => Alert.alert('저장 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.'),
  });

  const rowsByDate = useMemo(() => {
    const m: Record<string, AvailRow[]> = {};
    for (const r of rows) (m[r.date] ??= []).push(r);
    return m;
  }, [rows]);

  function countsFor(date: string): DayCounts {
    if (summary && summary[date]) return summary[date];
    if (preview) return placeholderCounts(date);
    return EMPTY;
  }

  // 하단 후보: 이번 달 & 불가 0명 & 가능 1명 이상. 가능 많은 순 → 빠른 날짜 순.
  const candidates = useMemo(() => {
    if (!summary) return [];
    return cells
      .filter((c) => c.inMonth)
      .map((c) => ({ date: c.date, counts: summary[c.date] ?? EMPTY }))
      .filter((c) => c.counts.unavailable === 0 && c.counts.available > 0)
      .sort((a, b) => b.counts.available - a.counts.available || (a.date < b.date ? -1 : 1))
      .slice(0, 6);
  }, [summary, cells]);

  function onPickDate(date: string) {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '일정 확인·입력은 로그인 후 이용할 수 있어요.');
      return;
    }
    setDetailDate(date);
  }

  return (
    <Screen scroll>
      <BrandHeader />

      {/* 월 이동 */}
      <View style={styles.header}>
        <Pressable onPress={() => setAnchor(addMonths(anchor, -1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>‹</Text>
        </Pressable>
        <Text variant="h1">{volLabel(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonths(anchor, 1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>›</Text>
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} variant="mono" style={styles.weekCell} color={i === 0 ? colors.light.neon : colors.light.textSecondary}>
            {w}
          </Text>
        ))}
      </View>

      {/* 6칸 게이지 그리드 */}
      <View style={styles.grid}>
        {cells.map((c) => (
          <GaugeCell
            key={c.date}
            date={c.date}
            day={Number(c.date.slice(8, 10))}
            inMonth={c.inMonth}
            counts={countsFor(c.date)}
            onPress={() => onPickDate(c.date)}
          />
        ))}
      </View>

      {/* 하단: 가능한 날 후보 (날짜 · 멤버 · 시간) */}
      <View style={styles.candidates}>
        <Text variant="kicker" color={colors.light.textSecondary}>가능한 날</Text>
        {candidates.length === 0 ? (
          <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.sm }}>
            {userId ? '아직 후보가 없어요. 날짜를 눌러 일정을 입력해보세요.' : '로그인하면 후보가 표시돼요.'}
          </Text>
        ) : (
          candidates.map((c) => {
            const avail = (rowsByDate[c.date] ?? []).filter((r) => r.status === 'available');
            return (
              <Pressable key={c.date} style={styles.candRow} onPress={() => onPickDate(c.date)}>
                <View style={styles.candDateCol}>
                  <Text variant="bodyBold" style={{ fontSize: 15 }}>{formatKo(c.date)}</Text>
                  <Text variant="caption" color={colors.light.textSecondary}>가능 {c.counts.available}명</Text>
                </View>
                <View style={styles.candMembers}>
                  {avail.map((r) => (
                    <View key={r.member_id} style={styles.memberChip}>
                      <View style={[styles.memberDot, { backgroundColor: r.color ?? colors.light.cobalt }]} />
                      <Text variant="caption">{r.nickname}</Text>
                      <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 10 }}>{timeLabel(r)}</Text>
                    </View>
                  ))}
                </View>
              </Pressable>
            );
          })
        )}
      </View>

      <DayDetailModal
        visible={detailDate != null}
        date={detailDate}
        rows={detailDate ? rowsByDate[detailDate] ?? [] : []}
        members={members}
        userId={userId}
        onClose={() => setDetailDate(null)}
        onEdit={() => {
          setEditDate(detailDate);
          setDetailDate(null);
        }}
      />
      <AvailabilityModal
        visible={editDate != null}
        date={editDate}
        saving={mutation.isPending}
        onClose={() => setEditDate(null)}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  candidates: { marginTop: space.xl, paddingTop: space.lg, borderTopWidth: 1, borderTopColor: colors.light.hairline },
  candRow: {
    flexDirection: 'row',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.light.hairline,
  },
  candDateCol: { width: 118, gap: 2 },
  candMembers: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'flex-start' },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.light.surfacePlate,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  memberDot: { width: 8, height: 8, borderRadius: 4 },
});
