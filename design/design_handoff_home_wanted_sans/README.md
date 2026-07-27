# Handoff: 월간gcu 홈 화면 — Wanted Sans / 하이에너지

## Overview
소규모 모임을 "월간지"처럼 기록·운영하는 앱 **월간gcu**의 홈(표지) 화면입니다.
콜드 스타트 시 "지금 뭘 하면 되는지"를 3초 안에 보여주는 토스형 요약 홈이며,
비주얼은 각지고 굵은 산세리프(Wanted Sans)와 초대형 이탤릭 D-day 숫자로 하이에너지 무드를 냅니다.

## About the Design Files
이 번들의 `home_wanted_sans.html`은 **HTML로 만든 디자인 레퍼런스(프로토타입)**입니다.
의도한 룩앤필과 동작을 보여주는 목적이며, 그대로 프로덕션에 복붙하는 코드가 아닙니다.
목표는 이 HTML 디자인을 **대상 코드베이스의 기존 환경(React / React Native / SwiftUI 등)과 패턴으로 재현**하는 것입니다.
아직 환경이 없다면 프로젝트에 가장 적합한 프레임워크를 택해 구현하세요.

## Fidelity
**High-fidelity (hifi)** — 색상/타이포/여백/라운드가 최종값입니다. 아래 토큰 값 그대로 픽셀 단위로 재현하세요.

## Screens / Views

### 홈 (표지)
- **Purpose**: 다음 모임 확인 → 참석/불참, 이번 달 일정 입력 유도, 최근 문서 진입.
- **Layout**: 모바일 세로 1컬럼. 프레임 폭 390px, 좌우 패딩 20px. 세로 흐름: 상태바 → 브랜드 헤더 → 히어로카드 → 액션 버튼 → 일정 카드 → 최근 목록 → 하단 탭바. 섹션 간 세로 간격 20~24px.

- **Components**:
  1. **상태바** — 높이 44px, 좌 `9:41` / 우 `VOL. 2026.08`. 폰트 Wanted Sans 12px, letter-spacing .6px.
  2. **브랜드 헤더** — 좌: 로고 마크(26×20px) + `월간gcu`(Wanted Sans 900, 18px). 우: `2026.08 · No.8`(kicker, 11px, +2px tracking, uppercase, color slate). row space-between, 하단 패딩 16px.
  3. **히어로카드** — 배경 `--ink` #14161D, 라운드 26px, 패딩 22px, overflow hidden. 흰 텍스트.
     - 우상단 장식 원: 120×120px, `--cobalt` 22% opacity, `right:-30 top:-30`.
     - 상단 row: 좌 칩 `◆ 다음 모임`(배경 cobalt, 흰 글씨, 11px 800, +1.5px tracking, uppercase, pill 5×10px 패딩) / 우 `08.15 SAT · 18:00`(kicker, 흰색 60%).
     - **D-day 숫자**: `D-19`, Big Shoulders Display 900 italic, font-size 96px, line-height .86, letter-spacing -1px. margin-top 14px.
     - 하단 구분선(위 border 1px rgba(255,255,255,.16), padding-top 16px) 아래 row: 좌 `성심당 본점`(15px 700) + `대전 중구`(12px, 흰 60%); 우 `₩25,000`(mono 14px, color #7FB0FF).
  4. **액션 버튼 행** — gap 8px. `참석할게요`(flex 2, 주 버튼: 배경 cobalt, 흰 글씨) + `불참`(flex 1, 보조: 투명 배경, 테두리 --ink-24, 글씨 ink). 버튼 공통: 높이 48px, 라운드 14px, 700, 15px.
  5. **일정 카드(softCard)** — 배경 `--mist` #EDECE8, 라운드 20px, 패딩 18px. 상단 row: `8월 일정, 아직이에요`(15px 700) + `마감 D-3` pill(배경 amber, ink 글씨, mono 13px 600, 라운드 999px, 높이 26px). 아바타 스택 6개(28px 원, 겹침 -8px, 흰 2px 링) — 앞 4개 활성, 뒤 2개 dim(grayscale, opacity .42) + `4 / 6 입력`(12px, slate). 하단 전체폭 주 버튼 `내 일정 입력하기`.
  6. **최근 목록(Recent)** — `Recent` kicker(slate) 아래 2행. 각 행: 좌 5px 점(1행 cobalt, 2행도 cobalt) + 제목(14px 500) + 우 상대시간(mono 10px, slate). 행 패딩 상하 11px.
  7. **하단 탭바** — 5탭(표지/달력/위키/정산/나). 상단 1px border(--ink-12). 각 탭: 아이콘 자리 20×20px 라운드 5px(활성=ink 채움, 비활성=1.5px 테두리 currentColor) + 라벨(mono 10px, uppercase, +1px). 활성 탭은 상단 22×2px ink 바 + ink 텍스트, 비활성은 slate. 탭 하단 패딩 22px(홈 인디케이터 여백).

## Interactions & Behavior
- 참석/불참 버튼: 눌러 참석 상태 토글(선택 시 주 버튼 채움 유지, 반대편 보조 처리).
- `내 일정 입력하기`: 8월 가용성 입력 플로우로 이동.
- 최근 목록 행: 해당 위키 문서로 이동.
- 탭바: 표지/달력/위키/정산/나 라우팅.
- 이 프로토타입에는 트랜지션이 명시돼 있지 않음 — 코드베이스 기본 press/hover(예: 눌림 시 살짝 어둡게)를 적용.

## State Management
- `attendance`: 'going' | 'not_going' | null (참석 버튼).
- `scheduleEntered`: boolean / 입력 인원 수(4 / 6) — 일정 카드 표시.
- `daysUntilMeetup`: number → `D-{n}` 파생. `deadlineDays` → `마감 D-{n}`.
- 최근 문서 목록: 배열(제목, 상대시간, 링크).

## Design Tokens
Colors
- `--ink` #14161D (본문/헤어라인/히어로 배경)
- `--paper` #FFFFFF (기본 배경)
- `--mist` #EDECE8 (섹션 플레이트 / 일정 카드)
- `--cobalt` #2140E0 (주 액션, 참석, 강조)
- `--neon` #E8318A (표지 액센트 — 이 화면에선 미사용, 시스템 토큰)
- `--amber` #FFC53D (마감 임박 경고 pill)
- `--slate` #7A7F8C (보조 텍스트/캡션)
- `--ink-12` rgba(20,22,29,.12) · `--ink-24` rgba(20,22,29,.24) (헤어라인/테두리)
- 히어로 내 금액 강조 텍스트: #7FB0FF (ink 위 밝은 코발트)

Radius: 카드 26px(히어로) / 20px(soft) · 버튼 14px · pill 999px · 탭 아이콘 5px · 프레임 34px
Spacing: 좌우 패딩 20px, 카드 패딩 18~22px, 섹션 간 20~24px, 버튼 gap 8px, 아바타 겹침 -8px
Shadows: 없음(그림자 대신 1px 헤어라인 사용). 아바타 링 = 흰 2px box-shadow.

Typography
- **Display(숫자)**: Big Shoulders Display 900 italic — D-day 96px/.86, -1px tracking
- **제목/브랜드(serif 클래스)**: Wanted Sans 900, -1px tracking
- **kicker/라벨**: Wanted Sans 800, 11px, +2px tracking, UPPERCASE
- **본문/버튼**: Pretendard 400/700
- **mono(날짜·금액·Vol·시간)**: IBM Plex Mono 500, +1.2px tracking, UPPERCASE

Fonts (CDN)
- Pretendard: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`
- Wanted Sans (Variable): `https://cdn.jsdelivr.net/gh/wanteddev/wanted-sans@v1.0.3/.../WantedSansVariable.min.css`
- Big Shoulders Display + IBM Plex Mono: Google Fonts
- ⚠️ Pretendard는 브리프 지정 폰트지만 라이선스 사본이 있으면 로컬 번들 권장.

## Assets
- **브랜드 마크** — GCU 로고(파랑/초록/시안/앰버 스워시). HTML 안에 인라인 SVG(data URI)로 포함됨. 원본은 프로젝트 `assets/gcu.svg`. 코드베이스엔 SVG 파일로 반입해 사용 권장.
- 아이콘: 탭바는 임시 도형(라운드 사각)으로 표현 — 실제 구현 시 코드베이스 아이콘 세트로 교체.
- 아바타: 이니셜 텍스트 원형(더미). 실제 프로필 이미지로 대체 가능.

## Files
- `home_wanted_sans.html` — 이 홈 화면의 자체 완결 HTML(토큰 인라인, 로고 인라인, 폰트 CDN). 브라우저로 바로 열림.
- (참고) 전체 컨셉 탐색: 프로젝트 루트 `홈 컨셉 탐색.html` — A/B/C 및 힙 A/B 시안 비교 캔버스.
