/**
 * 날짜 유틸 — 이 파일이 유일한 출처. 다른 파일에서 dayjs를 직접 import 하지 않는다.
 *
 * 절대 규칙 (CLAUDE.md, 05-SCHEDULING-LOGIC §6):
 * - 날짜는 `YYYY-MM-DD` 문자열로 다룬다. DB 컬럼은 `date` 타입.
 * - `new Date("2026-08-01")`은 UTC 자정으로 파싱돼 KST에서 7월 31일이 된다. 절대 금지.
 * - 타임존은 Asia/Seoul 고정. 월 경계는 dayjs().startOf('month')로.
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as Updates from 'expo-updates';

dayjs.extend(utc);
dayjs.extend(timezone);

export const TZ = 'Asia/Seoul';
dayjs.tz.setDefault(TZ);

/** `YYYY-MM-DD` 형식 날짜 문자열. 앱 전체에서 날짜의 표준 표현. */
export type DateStr = string;

/** 문자열을 KST 기준 dayjs 객체로. (직접 new Date 금지) */
function d(date: DateStr) {
  return dayjs.tz(date, TZ);
}

/** 오늘 (KST) `YYYY-MM-DD` */
export function todayStr(): DateStr {
  return dayjs().tz(TZ).format('YYYY-MM-DD');
}

/** 요일 (0=일 ~ 6=토), KST 기준 */
export function weekday(date: DateStr): number {
  return d(date).day();
}

/** 주말(토·일) 여부 */
export function isWeekend(date: DateStr): boolean {
  const w = weekday(date);
  return w === 0 || w === 6;
}

/** 해당 월의 1일 `YYYY-MM-01` */
export function startOfMonth(date: DateStr): DateStr {
  return d(date).startOf('month').format('YYYY-MM-DD');
}

/** 해당 월의 말일 */
export function endOfMonth(date: DateStr): DateStr {
  return d(date).endOf('month').format('YYYY-MM-DD');
}

/** n개월 이동 (음수 가능) */
export function addMonths(date: DateStr, n: number): DateStr {
  return d(date).add(n, 'month').format('YYYY-MM-DD');
}

/** n일 이동 */
export function addDays(date: DateStr, n: number): DateStr {
  return d(date).add(n, 'day').format('YYYY-MM-DD');
}

/** 두 날짜(문자열) 차이(일수). a - b */
export function diffDays(a: DateStr, b: DateStr): number {
  return d(a).diff(d(b), 'day');
}

/** D-day 숫자 (오늘 → target). 양수면 남은 일수. */
export function dday(target: DateStr): number {
  return diffDays(target, todayStr());
}

/**
 * 월 그리드 생성 (주 시작 = 일요일).
 * 앞뒤 빈칸은 이전/다음 달 날짜로 채우고 `inMonth: false`로 표시(흐리게 렌더용).
 * 2월/윤년/31일 없는 달에서도 깨지지 않는다.
 */
export function monthGrid(anchor: DateStr): { date: DateStr; inMonth: boolean }[] {
  const first = d(startOfMonth(anchor));
  const targetMonth = first.month();
  const gridStart = first.subtract(first.day(), 'day'); // 그 주 일요일로
  const cells: { date: DateStr; inMonth: boolean }[] = [];
  let cur = gridStart;
  // 6주(42칸) 채우되, 마지막 주가 완전히 다음 달이면 5주로 자른다.
  for (let i = 0; i < 42; i++) {
    const dateStr = cur.format('YYYY-MM-DD');
    cells.push({ date: dateStr, inMonth: cur.month() === targetMonth });
    cur = cur.add(1, 'day');
  }
  // 마지막 주(7칸)가 전부 이번 달이 아니면 제거
  const lastWeek = cells.slice(35, 42);
  if (lastWeek.every((c) => !c.inMonth)) return cells.slice(0, 35);
  return cells;
}

/** 표시용 포맷: "8월 15일 (토)" */
export function formatKo(date: DateStr): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dd = d(date);
  return `${dd.month() + 1}월 ${dd.date()}일 (${days[dd.day()]})`;
}

/** 호수 표기용: "2026.07" */
export function volLabel(date: DateStr): string {
  return d(date).format('YYYY.MM');
}

/** timestamptz(ISO) → KST "M.D HH:mm" (메모/코멘트 시간 표시용). */
export function formatDateTime(iso: string): string {
  return dayjs(iso).tz(TZ).format('M.D HH:mm');
}

/** 배포일 "YYYY.MM.DD" — 현재 실행 중인 OTA 업데이트 생성일(없으면 오늘, 개발 환경). */
export function deployDateLabel(): string {
  const created = Updates.createdAt; // Date | null
  const base = created ? dayjs(created) : dayjs();
  return base.tz(TZ).format('YYYY.MM.DD');
}
