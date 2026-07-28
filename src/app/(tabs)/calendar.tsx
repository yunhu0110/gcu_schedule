/**
 * S2. 달력 — 6칸 게이지 월 그리드 + 날짜 상세(누가 가능한지) + 하단 "가능한 날" 후보.
 * 날짜 탭 → 상세 팝업(가능/미등록 · 시간), 거기서 내 일정 입력/수정.
 *
 * 모델: 등록되는 건 "가능"뿐이다. 불가는 별도 상태가 아니라 등록해둔 가능을 지우는 동작(삭제).
 * 하단엔 이번 달 후보를 가능 인원 많은 순(내림차순)으로 멤버·시간과 함께 보여준다.
 */
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { BrandHeader } from '@/components/BrandHeader';
import { ActionModal } from '@/components/ActionModal';
import { GaugeCell, TIER_COLORS, type DayCounts } from '@/components/GaugeCell';
import { AvailabilityModal, type AvailabilitySubmit } from '@/features/availability/AvailabilityModal';
import { DayDetailModal } from '@/features/availability/DayDetailModal';
import { colors, radius, space } from '@/theme/tokens';
import { addMonths, dday, endOfMonth, formatKo, monthGrid, startOfMonth, todayStr, volLabel } from '@/lib/date';
import { clearRange, getMonthRows, getSummary, setRange, type AvailRow } from '@/api/availabilities';
import { listMembers } from '@/api/members';
import { getPoll } from '@/api/polls';
import { notifyMembers } from '@/api/notifications';
import { useAuth } from '@/features/auth/AuthContext';
import { useDevStore } from '@/store/devStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY: DayCounts = { available: 0, maybe: 0, unavailable: 0, missing: 0 };
const CANDIDATE_LIMIT = 10;
// 이제 상태는 '가능'과 '미등록'뿐이다. 예전에 저장된 불가/미정 행은 미등록으로 합쳐 보여준다.
const asRegistered = (c: DayCounts): DayCounts => ({
  available: c.available,
  maybe: 0,
  unavailable: 0,
  missing: c.missing + c.unavailable + c.maybe,
});
const fmtTime = (s: string | null) => (s ? s.slice(0, 5) : null);
const timeLabel = (r: AvailRow) => {
  const a = fmtTime(r.start_time);
  const b = fmtTime(r.end_time);
  return a && b ? `${a}–${b}` : '종일';
};

// 둘러보기(미로그인) 모드에서 빈 달력이 심심하지 않도록 만드는 가짜 집계.
function placeholderCounts(date: string): DayCounts {
  const n = [...date].reduce((a, c) => a + c.charCodeAt(0), 0);
  const available = n % 7;
  return { available, maybe: 0, unavailable: 0, missing: Math.max(0, 6 - available) };
}

export default function CalendarScreen() {
  const { userId } = useAuth();
  const preview = useDevStore((s) => s.previewMode);
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState(todayStr());
  const [detailDate, setDetailDate] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

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
  const aY = Number(anchor.slice(0, 4));
  const aM = Number(anchor.slice(5, 7));
  const { data: poll } = useQuery({
    queryKey: ['next-meeting', aY, aM],
    queryFn: () => getPoll(aY, aM),
    enabled: !!userId,
  });
  const confirmedDate = poll?.confirmed_date ?? null;

  // 가능 = 등록(upsert), 불가 = 등록해둔 가능을 지움(delete). 불가라는 상태는 저장하지 않는다.
  const mutation = useMutation({
    mutationFn: async (v: AvailabilitySubmit) => {
      if (!userId) throw new Error('로그인이 필요해요.');
      const nick = members.find((m) => m.id === userId)?.nickname ?? '멤버';
      const ids = members.map((m) => m.id);
      if (v.status === 'unavailable') {
        await clearRange(userId, v.from, v.to);
        await notifyMembers(userId, ids, 'availability_set', `${nick}님이 ${formatKo(v.from)} 가능 일정을 취소했어요.`, true);
        return;
      }
      await setRange(userId, v.from, v.to, 'available', v.note, v.startTime, v.endTime);
      await notifyMembers(userId, ids, 'availability_set', `${nick}님이 ${formatKo(v.from)} 일정(가능)을 등록했어요.`, true);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability-summary'] });
      qc.invalidateQueries({ queryKey: ['availability-rows'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
      setEditDate(null);
    },
    onError: (e) => Alert.alert('저장 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.'),
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('로그인이 필요해요.');
      await clearRange(userId, from, to);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability-summary'] });
      qc.invalidateQueries({ queryKey: ['availability-rows'] });
    },
    onError: (e) => Alert.alert('초기화 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.'),
  });

  const rowsByDate = useMemo(() => {
    const m: Record<string, AvailRow[]> = {};
    for (const r of rows) (m[r.date] ??= []).push(r);
    return m;
  }, [rows]);

  // 날짜별 "가능"한 멤버들의 프로필 색 — 게이지 칸을 각자 색으로 칠한다.
  // 등록된 순서 그대로 append(정렬하지 않는다). 색이 없는 멤버는 GaugeCell이 기본색으로 채운다.
  const availColorsByDate = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of rows) {
      if (r.status !== 'available') continue;
      (m[r.date] ??= []).push(r.color ?? colors.light.available);
    }
    return m;
  }, [rows]);

  // "홍길동님 2026-07 초기화" — 지워지는 게 내 일정이라는 걸 버튼에서 바로 알 수 있게.
  const myNickname = members.find((m) => m.id === userId)?.nickname ?? '나';
  const resetLabel = `${myNickname}님 ${anchor.slice(0, 7)} 초기화`;

  function countsFor(date: string): DayCounts {
    if (summary && summary[date]) return asRegistered(summary[date]);
    if (preview) return placeholderCounts(date);
    return EMPTY;
  }

  /**
   * 연두 그라데이션 순위 — 가능한 날(1명 이상)만 모아 가능 인원 내림차순으로 줄 세우고,
   * 상위 세 단계(같은 인원수는 같은 단계)에만 색을 준다. 절대 인원수가 아니라 그 달 안에서의 순위다.
   */
  const tierByDate = useMemo(() => {
    const m: Record<string, number> = {};
    if (!summary) return m;
    const inMonth = cells.filter((c) => c.inMonth);
    const counts = new Map<string, number>();
    for (const c of inMonth) {
      const n = asRegistered(summary[c.date] ?? EMPTY).available;
      if (n > 0) counts.set(c.date, n);
    }
    const ranks = [...new Set(counts.values())].sort((a, b) => b - a).slice(0, TIER_COLORS.length);
    for (const [date, n] of counts) {
      const i = ranks.indexOf(n);
      if (i >= 0) m[date] = i;
    }
    return m;
  }, [summary, cells]);

  // 하단 후보: 이번 달 & 가능 1명 이상. 가능 많은 순(내림차순) → 같으면 빠른 날짜 순.
  const candidates = useMemo(() => {
    if (!summary) return [];
    return cells
      .filter((c) => c.inMonth)
      .map((c) => ({ date: c.date, counts: asRegistered(summary[c.date] ?? EMPTY) }))
      .filter((c) => c.counts.available > 0)
      .sort((a, b) => b.counts.available - a.counts.available || (a.date < b.date ? -1 : 1))
      .slice(0, CANDIDATE_LIMIT);
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

      {confirmedDate ? (
        <View style={styles.confirmBanner}>
          <Text variant="bodyBold" color={colors.light.paper} style={{ fontSize: 14 }}>
            📌 확정 모임 · {formatKo(confirmedDate)}
          </Text>
          <Text variant="mono" color={colors.light.paper}>
            {(() => { const n = dday(confirmedDate); return n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`; })()}
          </Text>
        </View>
      ) : null}

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
            availColors={availColorsByDate[c.date]}
            tier={tierByDate[c.date]}
            marked={c.date === confirmedDate}
            onPress={() => onPickDate(c.date)}
          />
        ))}
      </View>

      {/* 범례 — 가능 인원 많은 순 1·2·3위 */}
      <View style={styles.legend}>
        {TIER_COLORS.map((c, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendChip, { backgroundColor: c }]} />
            <Text variant="caption" color={colors.light.textSecondary}>{i + 1}순위</Text>
          </View>
        ))}
      </View>

      {/* 내 일정 초기화 (해당 월) */}
      {userId ? (
        <Pressable style={styles.resetBtn} onPress={() => setResetOpen(true)}>
          <Text variant="bodySm" color={colors.light.textSecondary}>{resetLabel}</Text>
        </Pressable>
      ) : null}

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
      <ActionModal
        visible={resetOpen}
        title={resetLabel}
        message="이 달에 입력한 내 일정을 모두 지울까요?"
        actions={[
          { label: '초기화', destructive: true, onPress: () => resetMut.mutate() },
          { label: '취소', cancel: true },
        ]}
        onClose={() => setResetOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  confirmBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.light.cobalt, borderRadius: radius.button, paddingHorizontal: space.md, paddingVertical: space.sm, marginBottom: space.md },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },

  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendChip: { width: 14, height: 10, borderRadius: 3 },

  resetBtn: {
    alignSelf: 'center',
    marginTop: space.lg,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.light.hairlineStrong,
  },
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
