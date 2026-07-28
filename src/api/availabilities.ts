/**
 * 가용성 쿼리 함수 — 달력 집계 조회 + 본인 일정 입력(범위 upsert).
 * supabase 접근은 여기서만. 날짜는 YYYY-MM-DD 문자열(lib/date), 타임존 변환 금지.
 * 참조: 02-DATA-MODEL §availabilities, 05-SCHEDULING-LOGIC §7(upsert 마지막 쓰기 승리).
 */
import { supabase } from '@/lib/supabase';
import { addDays, diffDays, type DateStr } from '@/lib/date';
import type { DayCounts } from '@/components/GaugeCell';

export type AvailabilityStatus = 'available' | 'unavailable' | 'maybe';

/** 날짜 → 6칸 집계. availability_summary RPC 결과를 화면용 map으로. */
export type MonthSummary = Record<DateStr, DayCounts>;

/** 월 범위 집계(활성 멤버 기준). p_from~p_to 각 날짜의 available/unavailable/maybe/missing. */
export async function getSummary(from: DateStr, to: DateStr): Promise<MonthSummary> {
  const { data, error } = await supabase.rpc('availability_summary', { p_from: from, p_to: to });
  if (error) throw error;
  const map: MonthSummary = {};
  for (const row of (data ?? []) as SummaryRow[]) {
    map[row.d] = {
      available: row.available_count,
      unavailable: row.unavailable_count,
      maybe: row.maybe_count,
      missing: row.missing_count,
    };
  }
  return map;
}

type SummaryRow = {
  d: DateStr;
  available_count: number;
  unavailable_count: number;
  maybe_count: number;
  missing_count: number;
  all_available: boolean;
};

/**
 * from~to 각 날짜를 하나의 상태로 upsert(본인). 사유(note)는 선택.
 * startTime/endTime은 'HH:MM' 또는 null(하루 종일). 실사용 상태는 available/unavailable 2종.
 */
export async function setRange(
  memberId: string,
  from: DateStr,
  to: DateStr,
  status: AvailabilityStatus,
  note: string | null,
  startTime: string | null,
  endTime: string | null,
): Promise<void> {
  const span = diffDays(to, from);
  const start = span < 0 ? to : from; // 뒤집혀 들어와도 방어
  const count = Math.abs(span);
  const rows = Array.from({ length: count + 1 }, (_, i) => ({
    member_id: memberId,
    date: addDays(start, i),
    status,
    note: note?.trim() ? note.trim() : null,
    start_time: startTime,
    end_time: endTime,
  }));
  const { error } = await supabase
    .from('availabilities')
    .upsert(rows, { onConflict: 'member_id,date' });
  if (error) throw error;
}

/** 특정 날짜 범위의 본인 입력을 지운다(미입력으로 되돌림). */
export async function clearRange(memberId: string, from: DateStr, to: DateStr): Promise<void> {
  const [lo, hi] = diffDays(to, from) < 0 ? [to, from] : [from, to];
  const { error } = await supabase
    .from('availabilities')
    .delete()
    .eq('member_id', memberId)
    .gte('date', lo)
    .lte('date', hi);
  if (error) throw error;
}
