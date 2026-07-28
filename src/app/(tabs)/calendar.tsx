/**
 * S2. 달력 (메인) — 6칸 게이지 월 그리드. 날짜를 누르면 일정 입력 팝업이 뜬다.
 * 로그인 상태면 availability_summary(집계)를 읽어 실제 게이지를 그리고, 입력은 본인 upsert.
 * 미로그인 둘러보기(preview)에서는 날짜 기반 플레이스홀더로 화면만 채운다.
 * 참조: 05-SCHEDULING-LOGIC, 02-DATA-MODEL §availabilities.
 */
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Logo } from '@/components/Logo';
import { GaugeCell, type DayCounts } from '@/components/GaugeCell';
import { AvailabilityModal, type AvailabilitySubmit } from '@/features/availability/AvailabilityModal';
import { colors, space } from '@/theme/tokens';
import { addMonths, endOfMonth, monthGrid, startOfMonth, todayStr, volLabel } from '@/lib/date';
import { getSummary, setRange } from '@/api/availabilities';
import { useAuth } from '@/features/auth/AuthContext';
import { useDevStore } from '@/store/devStore';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY: DayCounts = { available: 0, maybe: 0, unavailable: 0, missing: 0 };

// 미로그인 둘러보기용 결정적 플레이스홀더(합 = 6). 실제 데이터는 로그인 후 집계.
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

function isAllAvailable(c: DayCounts): boolean {
  const total = c.available + c.maybe + c.unavailable + c.missing;
  return total > 0 && c.available === total;
}

export default function CalendarScreen() {
  const { userId } = useAuth();
  const preview = useDevStore((s) => s.previewMode);
  const qc = useQueryClient();

  const [anchor, setAnchor] = useState(todayStr());
  const [picked, setPicked] = useState<string | null>(null);

  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  const cells = monthGrid(anchor);

  const { data: summary } = useQuery({
    queryKey: ['availability-summary', from, to],
    queryFn: () => getSummary(from, to),
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: (v: AvailabilitySubmit) => {
      if (!userId) throw new Error('로그인이 필요해요.');
      return setRange(userId, v.from, v.to, v.status, v.note, v.startTime, v.endTime);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['availability-summary'] });
      setPicked(null);
    },
    onError: (e) => Alert.alert('저장 실패', e instanceof Error ? e.message : '잠시 후 다시 시도해주세요.'),
  });

  function countsFor(date: string): DayCounts {
    if (summary && summary[date]) return summary[date];
    if (preview) return placeholderCounts(date);
    return EMPTY;
  }

  const allDays = cells.filter((c) => c.inMonth && isAllAvailable(countsFor(c.date)));

  function onPickDate(date: string) {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '일정 입력은 로그인 후 이용할 수 있어요.');
      return;
    }
    setPicked(date);
  }

  return (
    <Screen scroll>
      {/* 브랜드 헤더 (로고 왼쪽 + 월간gcu) */}
      <View style={styles.brandRow}>
        <Logo height={22} />
        <Text variant="brand">월간gcu</Text>
      </View>

      {/* 월 이동 */}
      <View style={styles.header}>
        <Pressable onPress={() => setAnchor(addMonths(anchor, -1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>
            ‹
          </Text>
        </Pressable>
        <Text variant="h1">{volLabel(anchor)}</Text>
        <Pressable onPress={() => setAnchor(addMonths(anchor, 1))} hitSlop={12}>
          <Text variant="h2" color={colors.light.textSecondary}>
            ›
          </Text>
        </Pressable>
      </View>

      {/* 요일 헤더 */}
      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            variant="mono"
            style={styles.weekCell}
            color={i === 0 ? colors.light.neon : colors.light.textSecondary}
          >
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

      {/* 하단 요약 */}
      <View style={styles.summary}>
        <View style={styles.dot} />
        <Text variant="bodySm" color={colors.light.textSecondary}>
          {allDays.length > 0
            ? `전원 가능한 날 ${allDays.length}개`
            : '날짜를 눌러 내 일정을 입력해보세요'}
        </Text>
      </View>

      <AvailabilityModal
        visible={picked != null}
        date={picked}
        saving={mutation.isPending}
        onClose={() => setPicked(null)}
        onSubmit={(v) => mutation.mutate(v)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  weekCell: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.hairline,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.light.neon },
});
