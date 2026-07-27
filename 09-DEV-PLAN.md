# 09. 개발 기획서 (Dev Plan) — 월간gcu

> PRD·데이터모델·화면명세를 **실제 착수 가능한 개발 순서**로 번역한 문서.
> "무엇을 만드나"는 `01`~`05`, "어떻게 배포하나"는 `06`, "언제 하나"는 `07`.
> 이 문서는 그 사이 — **어떤 순서로, 무엇을 먼저 손대나**를 정한다.
> 작업 중단 대비 현재 상태는 항상 `progress.md`에서 확인/갱신한다.

## 0. 확정된 전제 (2026-07-27)
`08-OPEN-QUESTIONS.md`의 ADR 참조.

| 항목 | 결정 |
|---|---|
| 앱 이름 | **월간gcu** (slug `wolgan-gcu`, scheme `wolgangcu`, bundle `com.wolgangcu.app`) |
| 플랫폼 | iOS + Android 동시. Expo(React Native) 단일 코드베이스 |
| 백엔드 | Supabase (Postgres + Auth + RLS + Realtime + Storage) |
| 로그인 | 이메일 + 비밀번호. 수집: 닉네임 · 프로필사진 · 이메일 |
| 가입 | 관리자 발급 1회용 초대 코드 → 이메일/비번 설정. 활성 6명 도달 시 DB 트리거로 차단 |
| 모임 주기 | 유동적. 호스트는 매월 교체, 모임은 다음 달로 밀릴 수 있음 (`meetups`에 year+month 유니크 없음) |
| 가용성 | 하루 단위 + 메모 |
| 배포 | 스토어 없음. EAS 내부 배포(Android APK 링크 / iOS는 멤버십 결제 후 TestFlight) + EAS Update(OTA) |
| UI/UX | **기능 먼저**, 디자인 다듬기는 뒤로. 단, 하드코딩 금지 규칙(`tokens.ts`)은 처음부터 지킨다 |

## 1. 개발 원칙 (매 작업에서 지킴)
1. **문서가 먼저.** 스펙과 코드가 어긋나면 `docs/`부터 고친다. 애매하면 `08-OPEN-QUESTIONS.md`에 적고 질문.
2. **날짜는 문자열 `YYYY-MM-DD` + `date` 타입.** 타임존 변환 금지. 날짜 유틸은 `src/lib/date.ts` 한 곳.
3. **서버 접근은 `src/api/*.ts`를 통해서만.** 컴포넌트에서 `supabase.from()` 직접 호출 금지.
4. **색·간격·폰트는 `src/theme/tokens.ts`에서만.** 리터럴 hex 금지.
5. **RLS 먼저 켜고 정책 작성.** service_role key는 앱/EAS에 넣지 않는다.
6. **기능 하나 = 브랜치 하나.** 커밋 메시지 `feat|fix|docs|refactor|chore: 한국어 요약`.
7. **커밋 전 `npx tsc --noEmit` 통과.**

## 2. 아키텍처 한 장
```
[Expo App (iOS/Android)]
  app/                      expo-router 라우트 (auth / tabs / meetup / archive / admin)
  src/
    api/*.ts                supabase 쿼리 함수 (유일한 DB 접근 경로)
    features/               host · availability · meetup · wiki · settlement
    components/             재사용 UI (Text/Button/Card/Sheet/Avatar/GaugeCell ...)
    hooks/                  useCurrentHost, useAvailabilitySummary ...
    lib/                    date.ts(dayjs 래퍼) · supabase.ts(클라이언트) · queryClient.ts
    theme/tokens.ts         디자인 토큰 단일 출처
    store/                  zustand (로컬 UI 상태 최소)
    i18n/ko.ts              모든 문구
        │  anon key만. auth.uid() 기반 RLS.
        ▼
[Supabase]
  Postgres + RLS + 트리거(6인 정원) + 함수(availability_summary, is_current_host)
  Auth (email/password)     Storage(avatars, covers, wiki images)
  Edge Function: join(초대코드 검증 → members 행 생성)   Realtime: availabilities, date_votes
```
- **서버 상태 = TanStack Query**, **로컬 UI 상태 = Zustand(최소)**. 캐시 무효화 키를 `src/api`에 상수로.
- 낙관적 업데이트: 가용성 토글 등은 즉시 반영 후 서버 반영, 실패 시 롤백 + 토스트.

## 3. 마일스톤별 개발 순서

### M0 — 기반 "6명이 로그인해서 서로 보인다"
로드맵 M0을 착수 단위로 쪼갠 것. **이 문서 승인 후 여기부터 코딩.**

- **M0-1 리포지토리 & 툴체인**
  - [ ] git init + `.gitignore`(Expo/RN + 시크릿: `.env*`, `google-services.json`, `*.p8`, `*.mobileprovision`)
  - [ ] `create-expo-app` (TypeScript 템플릿, expo-router) → SDK 버전 **핀 고정**
  - [ ] ESLint + Prettier + `tsconfig` strict, `npm run typecheck` 스크립트
  - [ ] 핵심 라이브러리 설치 (호환성 확인 후): `@tanstack/react-query` · `zustand` · `@supabase/supabase-js` · `dayjs` · `react-native-reanimated` · `expo-secure-store` · `expo-font` · `expo-image-picker`
- **M0-2 앱 뼈대**
  - [ ] `src/theme/tokens.ts` (색 7 + 타이포 스케일 + 간격, light/dark 구조로 light만)
  - [ ] 폰트 프리로드 (`Noto Serif KR`, `Pretendard`, `IBM Plex Mono`) + 스플래시 유지
  - [ ] 기초 컴포넌트: `Text`, `Button`, `Card`, `Sheet`, `Avatar`
  - [ ] `src/lib/date.ts` (dayjs + timezone Asia/Seoul 래퍼) + `src/lib/supabase.ts` + `src/lib/queryClient.ts`
  - [ ] `src/i18n/ko.ts` 시작
  - [ ] 라우팅 뼈대: `(auth)/sign-in`, `(auth)/join`, `(tabs)` 5탭 빈 화면
- **M0-3 Supabase 기반**
  - [ ] Supabase 프로젝트 생성, `.env`에 URL + anon key (`EXPO_PUBLIC_` 접두사)
  - [ ] 마이그레이션 `0001_members_invites.sql`: `members`, `invite_codes`, 6인 정원 트리거, RLS
  - [ ] Edge Function `join`: 초대 코드 검증 → auth 유저와 연결된 `members` 행 생성
  - [ ] 관리자 본인 계정 + 초대 코드 5개 발급 (seed)
- **M0-4 인증 흐름**
  - [ ] `sign-in` (이메일/비번), 세션 `expo-secure-store` 자동 로그인
  - [ ] `join` (초대코드 → 이메일/비번 → 닉네임/프로필사진 업로드 → 홈)
  - [ ] 정원/코드 오류를 문구 그대로 노출 (i18n)
  - [ ] `me` 탭에 로그아웃 + 내 프로필 표시로 "서로 보인다" 확인
- **M0-5 배포 파이프라인 관통 (초반에 뚫는다)**
  - [ ] `eas init` (EAS 프로젝트 ID 생성) + `eas.json` (`dev` / `preview` 프로필, preview = internal APK)
  - [ ] Android APK 내부 배포 1회 성공 → 링크로 실기기 설치 확인
  - [ ] (iOS는 멤버십 결제 후 별도. M0에서는 dev build/Expo Go로 동작만 확인)
  - [ ] **CI/CD 활성화 (ADR-007)**: `EXPO_TOKEN`을 GitHub Secret에 등록 → `.github/workflows/eas-update.yml` 동작 확인
        (워크플로 파일은 이미 준비됨. 앱 파일이 생기면 push 시 자동으로 `eas update` OTA 실행)
  - **완료 기준: 6명이 각자 폰에 설치 → 로그인 → 서로의 닉네임/프사가 보인다. + main push 한 번으로 OTA가 자동 반영된다.**

### M1 — 핵심 "앱에서 다음 모임 날짜를 확정한다"
- **M1-1** `hosts` 마이그레이션 + `current_host` 뷰 + `is_current_host()` → 표지 화면 S1 + 로테이션 관리 S9
- **M1-2** `availabilities` + `recurring_blocks` 마이그레이션 → 6칸 게이지 달력 S2 (탭 순환 + 롱프레스 범위 입력)
- **M1-3** `availability_summary(from,to)` 함수 + 추천 알고리즘(`05` §4) → **테스트 케이스 7개 통과**
- **M1-4** `meetups` + `date_candidates`/`date_votes` + `attendances` → 모임 상세 S3 (후보/투표/확정, `voting` 조건부 확정)
- **M1-5** Realtime 구독(availabilities, date_votes)으로 달력 게이지 실시간 갱신
- **M1-6** iOS 배포 결정 → TestFlight 1회 (멤버십 결제 시)
- ✅ **여기까지가 실사용 최소 단위.** 6명 배포 후 한 달 운영.

### M2 — 기록 (위키·알림)
`07-ROADMAP.md` M2 그대로: 위키 목록/상세/편집/리비전(S4·S5) → 모임 완료 시 회차 문서 자동 생성 → 전문검색 → 푸시 알림(F7, dev build 필요).

### M3 — 살림 / M4 — 완성도
정산(S7) · 참석/뱃지(F6) · 과월호 서가(S6) · 사진 업로드 → 이후 다크모드 · 지도핀 · 표지 리빌 연출 · 에러수집/백업.

## 4. 지금 열려 있는 리스크 / 확인 필요
- **iOS 상시 배포 비용**: Apple Developer Program 유료. M1 iOS 배포 시점에 결제 여부 재확인 (그 전까진 Android APK + 양 OS dev build).
- **Supabase 무료 프로젝트 미사용 시 일시정지** 가능 → 6명이 매일 안 쓰면 확인 (`06` 체크리스트).
- **아직 미결정(해당 마일스톤에서 질문)**: 모임장 로테이션 규칙(Q5), 모임장 권한 범위(Q7), 회비/불참비(Q8·Q9), 위키 삭제 권한(Q12).

## 5. 다음 액션 (이 문서 직후)
1. `git init` + `.gitignore` + 최초 커밋 (planning 문서 4개 + progress.md)
2. **[승인 대기]** M0-1 Expo 스캐폴딩 시작 — 무거운 단계라 기획서 확인 후 진행
3. 이후 M0-2 → M0-5 순서로. 각 단계 완료 시 `progress.md` 갱신.
