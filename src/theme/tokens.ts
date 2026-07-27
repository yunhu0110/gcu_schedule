/**
 * 디자인 토큰 — 단일 출처 (03-UI-UX-GUIDE, 10-DESIGN-BRIEF 참조).
 * 색·간격·폰트는 반드시 여기서만 가져온다. 컴포넌트에서 리터럴 hex 금지.
 * 다크 모드는 P3. 지금은 light만 채우되, 나중에 light/dark 두 세트를 담을 수 있는 구조로 둔다.
 */

// 기본 팔레트 (이 7개 밖의 색은 쓰지 않는다)
const palette = {
  ink: '#14161D', // 본문 텍스트, 헤어라인, 불가 상태
  paper: '#FFFFFF', // 기본 배경
  mist: '#EDECE8', // 판면(섹션 배경), 미입력 상태
  cobalt: '#2140E0', // 주 액션, 가능 상태
  neon: '#E8318A', // 표지 강조, 전원 가능 날짜
  amber: '#FFC53D', // 미정 상태, 마감 임박 경고
  slate: '#7A7F8C', // 보조 텍스트, 캡션
} as const;

// 투명도 파생 (rgba). ink 계열만 우선 정의, 필요 시 확장.
const alpha = {
  ink12: 'rgba(20, 22, 29, 0.12)', // 헤어라인
  ink08: 'rgba(20, 22, 29, 0.08)',
  ink04: 'rgba(20, 22, 29, 0.04)',
} as const;

const light = {
  ...palette,
  ...alpha,
  // 시맨틱 별칭 (가용성 상태 → 게이지 색)
  available: palette.cobalt,
  unavailable: palette.ink,
  maybe: palette.amber,
  missing: palette.mist,
  allAvailable: palette.neon,
  hairline: alpha.ink12,
  textPrimary: palette.ink,
  textSecondary: palette.slate,
  bg: palette.paper,
  bgSection: palette.mist,
} as const;

export const colors = { light, dark: light } as const; // dark는 P3, 지금은 light 복제

// 서체 (expo-font로 프리로드 후 이 이름으로 참조). 로드 전 폴백은 컴포넌트에서 처리.
export const fonts = {
  display: 'NotoSerifKR_900Black', // 표지 이름, 화면 대제목 — 절제해서
  body: 'Pretendard-Regular',
  bodyBold: 'Pretendard-SemiBold',
  mono: 'IBMPlexMono-Medium', // 호수, 날짜, D-day, 금액, 카운터
} as const;

// 타이포 스케일: [fontSize, lineHeight]
export const type = {
  display: { fontSize: 44, lineHeight: 44 * 1.15, fontFamily: fonts.display },
  h1: { fontSize: 26, lineHeight: 26 * 1.3, fontFamily: fonts.display },
  h2: { fontSize: 20, lineHeight: 20 * 1.35, fontFamily: fonts.bodyBold },
  body: { fontSize: 16, lineHeight: 16 * 1.5, fontFamily: fonts.body },
  bodySm: { fontSize: 14, lineHeight: 14 * 1.5, fontFamily: fonts.body },
  caption: { fontSize: 12, lineHeight: 12 * 1.4, fontFamily: fonts.body },
  mono: {
    fontSize: 12,
    lineHeight: 12 * 1.2,
    fontFamily: fonts.mono,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
} as const;

// 8pt 그리드
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  screen: 20, // 화면 좌우 여백
  xl: 24,
  section: 32, // 섹션 간격
} as const;

export const radius = {
  card: 4,
  button: 8,
  cover: 0, // 표지는 full-bleed
} as const;

export const hairline = { width: 1, color: light.hairline } as const;

// 접근성/터치 하한선
export const layout = {
  minTouch: 44,
  minWidth: 320,
} as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = typeof light;
