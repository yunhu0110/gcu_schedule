/**
 * 디자인 토큰 — 단일 출처.
 * 방향(ADR-008): 기본은 "Wanted Sans 하이에너지"(굵은 산세리프 + 큰 라운드 + 초대형 D-day),
 * 감성 포인트(월간 표지·과월호)에는 명조(serif)와 neon을 아껴 남긴다.
 *
 * 폰트 현황: Wanted Sans/Pretendard 라이선스 파일 번들 전까지 Google 폰트로 스탠드인.
 *   - 브랜드/제목(Wanted Sans 역할) → Noto Sans KR 900
 *   - 본문(Pretendard 역할)         → Noto Sans KR 400/700
 *   - 초대형 D-day 숫자              → Big Shoulders Display 900 (이탤릭은 skew로 흉내)
 *   - 숫자/날짜/금액/호수            → IBM Plex Mono 500/600
 *   - 표지 감성 명조                  → Noto Serif KR 900
 */

const palette = {
  ink: '#14161D',
  paper: '#FFFFFF',
  mist: '#EDECE8',
  cobalt: '#2140E0',
  neon: '#E8318A',
  amber: '#FFC53D',
  slate: '#7A7F8C',
  red: '#FF3B30',
  // 토스 톤(리뉴얼): 밝은 블루 베이스 + 라벤더 보조. 기존 cobalt/neon은 그대로 두고 추가만.
  cobaltBright: '#3B5BFF', // 리뉴얼 메인 버튼/강조(살짝 밝은 코발트)
  skyWash: '#EEF3FF', // 연블루 카드/칩 배경
  lavender: '#ECECFB', // 라벤더 보조 배경
  lavenderInk: '#6E6AE0', // 라벤더 위 텍스트/아이콘
  navy: '#2A2E4A', // 통계/히어로 다크 카드(마이페이지 '내 일정 통계')
  // 리디자인(stitch_redesign 정확값) — 토스풍 밝은 블루
  renewPrimary: '#1D58D8', // 메인 블루(히어로/버튼/강조)
  renewBright: '#3B82F6', // 밝은 블루(그라데이션/보조 강조)
  renewWash: '#EFF6FF', // 아주 연한 블루 서피스(칩·링크 배경)
  renewWashDeep: '#DBEAFE', // 연블루(선택/강조 배경)
  renewStat: '#1C273C', // 마이페이지 다크 통계 카드
  renewBg: '#F8F9FC', // 리디자인 화면 배경(살짝 블루 틴트)
  renewCardSoft: '#EFF4FA', // 보조 카드(연블루 그레이)
} as const;

const alpha = {
  ink04: 'rgba(20,22,29,0.04)',
  ink06: 'rgba(20,22,29,0.06)',
  ink08: 'rgba(20,22,29,0.08)',
  ink12: 'rgba(20,22,29,0.12)',
  ink24: 'rgba(20,22,29,0.24)',
  ink60: 'rgba(20,22,29,0.60)',
  paper12: 'rgba(255,255,255,0.12)',
  paper16: 'rgba(255,255,255,0.16)',
  paper60: 'rgba(255,255,255,0.60)',
  paper80: 'rgba(255,255,255,0.80)',
  cobalt12: 'rgba(33,64,224,0.12)',
  cobalt22: 'rgba(33,64,224,0.22)',
  neon12: 'rgba(232,49,138,0.12)',
  amber24: 'rgba(255,197,61,0.24)',
} as const;

const light = {
  ...palette,
  ...alpha,
  // 시맨틱 별칭
  textPrimary: palette.ink,
  textSecondary: palette.slate,
  textOnDark: palette.paper,
  bg: palette.paper,
  surfacePlate: palette.mist,
  surfaceCard: palette.paper,
  heroBg: palette.ink,
  hairline: alpha.ink12,
  hairlineStrong: alpha.ink24,
  action: palette.cobalt,
  accent: palette.neon,
  warn: palette.amber,
  danger: palette.red,
  moneyOnDark: '#7FB0FF', // ink 히어로 위 밝은 코발트(금액 강조)
  // 가용성 상태 (6칸 게이지)
  available: palette.cobalt,
  unavailable: palette.ink,
  maybe: palette.amber,
  missing: palette.mist,
  allAvailable: palette.neon,
  // 달력 배경 하이라이트 — 가능 인원 순위별 연두(1순위=진함 → 채도 down)
  availAll: '#B6EA6A',
  availHigh: '#D6EFB2',
  availMid: '#EAF4DC',
  // 리뉴얼(토스 톤) 시맨틱 별칭 — 신규 화면/리디자인에서 사용
  bgApp: '#F6F8FD', // 화면 바깥 배경(살짝 블루 틴트). 카드가 떠 보이게
  surfaceSoft: palette.skyWash, // 연블루 서피스(칩·보조 카드)
  surfaceLavender: palette.lavender,
  statCardBg: palette.navy, // 다크 통계/히어로 카드
  actionBright: palette.cobaltBright,
  onSoft: palette.cobalt, // 연블루 서피스 위 텍스트
  // 리디자인(stitch_redesign) 시맨틱 별칭
  renewPrimary: palette.renewPrimary,
  renewBright: palette.renewBright,
  renewWash: palette.renewWash,
  renewWashDeep: palette.renewWashDeep,
  renewStat: palette.renewStat,
  renewBg: palette.renewBg,
  renewCardSoft: palette.renewCardSoft,
  // 데블스 플랜 전용(stitch_devil 레퍼런스 정확값)
  devilBg: '#12141F',
  devilCard: '#1B1E2E',
  devilBlue: '#2563EB', // 메인 블루(버튼/강조/선택)
  devilBlueDeep: '#1D4ED8', // 버튼 눌림/강조
  devilBlueWash: '#EEF4FF', // 선택 셀/칩 연블루 배경
  devilAccent: '#2563EB',
  devilInk: '#191F28', // 제목(토스 ink)
  devilSub: '#8B95A1', // 보조 텍스트(토스)
  devilCellBg: '#F3F4F8', // 미선택 회차 셀 회색 채움
  devilAmber: '#F59E0B', // 우승 월계관
  devilAmberLight: '#FBBF24', // 네임플레이트/트로피
} as const;

export const colors = { light, dark: light } as const; // dark는 P3

// 폰트 패밀리 (fonts.ts의 fontMap 키와 일치해야 함)
export const fonts = {
  display: 'Jalnan2', // 브랜드 워드마크·대형 타이틀 (둥글넓적 하이에너지)
  brand: 'JalnanGothic', // 화면 제목 h1/h2·눈썹 라벨 (굵은 고딕)
  body: 'NotoSansKR_400Regular',
  bodyBold: 'NotoSansKR_700Bold',
  mono: 'IBMPlexMono_500Medium',
  monoSemibold: 'IBMPlexMono_600SemiBold',
  ddayNumber: 'BigShouldersDisplay_900Black', // 초대형 D-day
  serif: 'NotoSerifKR_900Black', // 표지·과월호 감성
} as const;

// 타이포 스케일 (fontFamily 포함 — 폰트는 스플래시에서 프리로드 후 렌더)
// lineHeight는 잘난체/Noto Sans KR의 큰 세로 메트릭 기준으로 넉넉히(≈1.4~1.5×) 잡는다.
// 좁게 잡으면 Android에서 한글 글자 위/아래가 잘린다. 인라인 fontSize 오버라이드가
// 이 lineHeight를 물려받는 경우까지 감안해 여유를 둔다.
export const type = {
  brand: { fontSize: 20, lineHeight: 28, fontFamily: fonts.display, letterSpacing: -0.5 },
  h1: { fontSize: 26, lineHeight: 36, fontFamily: fonts.brand, letterSpacing: -0.5 },
  h2: { fontSize: 20, lineHeight: 28, fontFamily: fonts.brand },
  body: { fontSize: 16, lineHeight: 24, fontFamily: fonts.body },
  bodyBold: { fontSize: 16, lineHeight: 24, fontFamily: fonts.bodyBold },
  bodySm: { fontSize: 14, lineHeight: 21, fontFamily: fonts.body },
  caption: { fontSize: 12, lineHeight: 18, fontFamily: fonts.body },
  kicker: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.brand,
    letterSpacing: 2,
    textTransform: 'uppercase' as const,
  },
  mono: {
    fontSize: 12,
    lineHeight: 18,
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
  screen: 20,
  xl: 24,
  section: 32,
} as const;

// 라운드 — 하이에너지 방향(크게). 표지(감성)만 square 유지.
export const radius = {
  card: 16,
  soft: 20,
  hero: 26,
  button: 14,
  pill: 999,
  tabIcon: 5,
  cover: 0,
} as const;

export const hairline = { width: 1, color: light.hairline } as const;

// 그림자 — 토스 톤 카드의 "떠 있는" 느낌. iOS=shadow*, Android=elevation 동시 지정.
// card: 기본 카드, soft: 은은한 칩/작은 요소, hero: 강조 히어로 카드.
export const shadow = {
  card: {
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
  soft: {
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  hero: {
    shadowColor: '#1B2559',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
} as const;

export const layout = {
  minTouch: 44,
  buttonHeight: 48,
  minWidth: 320,
} as const;

// 멤버 표시색 팔레트(20색) — 마이페이지에서 선택. 앞 6색은 DB 0005 기본 배정과 동일 순서.
// 달력 상세/후보 목록에서 각 멤버를 이 색으로 표시한다.
export const memberColors = [
  '#2140E0', '#E8318A', '#00B9F2', '#80C341', '#FCAF16', '#7A5AF8',
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4',
  '#3B82F6', '#6366F1', '#A855F7', '#D946EF', '#EC4899', '#F43F5E',
  '#0EA5E9', '#64748B',
] as const;

export type ColorScheme = keyof typeof colors;
export type ThemeColors = typeof light;
