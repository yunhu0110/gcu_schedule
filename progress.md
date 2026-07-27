# progress.md — 월간gcu 진행 상황 (중간 세이브)

> 작업이 중단될 수 있으므로 **매 작업 후 이 파일을 갱신**한다.
> 새 세션은 이 파일 → `09-DEV-PLAN.md` → `08-OPEN-QUESTIONS.md` 순으로 읽고 이어간다.

**최종 갱신:** 2026-07-27
**현재 단계:** 🎉 M0 마일스톤 사실상 완료 — Android APK 빌드/배포 링크 확보 + CI OTA 자동배포 초록. 남은 것: (1) Expo 토큰 재발급(노출) (2) 관리자 부트스트랩 SQL 확인 (3) iOS 배포(멤버십, M1) (4) M1 실데이터. previewMode 우회 정리 예정.

## 지금 어디까지 왔나
- [x] 기획 문서 8개(01~08) 정독
- [x] 4대 결정 확정 (ADR-001~006) → `08-OPEN-QUESTIONS.md` 기록
- [x] `02-DATA-MODEL.md`의 `meetups` 정의를 ADR-005(유동 주기)에 맞춰 갱신
- [x] `09-DEV-PLAN.md` 개발 기획서 작성
- [x] `10-DESIGN-BRIEF.md` 디자인 핸드오프 브리프 작성 (디자이너/디자인툴에 던지는 자체완결 문서)
- [x] `progress.md` 생성
- [x] git init + .gitignore + 최초 커밋 (`main` 브랜치)
- [x] GitHub 원격 연동 (`origin` = yunhu0110/gcu_schedule, HTTPS, push 완료)
- [x] CI/CD 워크플로 준비 `.github/workflows/eas-update.yml` (ADR-007, dormant — M0에서 활성화)
- [x] **M0-1 Expo 스캐폴딩 완료**:
  - create-expo-app (Expo SDK 57, TypeScript, expo-router) → 루트로 병합 (우리 CLAUDE.md/문서 보존)
  - app.json 식별자: name 월간gcu, owner yunhu, slug/scheme gcuschedule, bundle com.yunhu.gcuschedule, light 고정, runtimeVersion appVersion
  - 핵심 라이브러리 설치: @supabase/supabase-js, @tanstack/react-query, zustand, dayjs, expo-secure-store, expo-image-picker, react-native-url-polyfill
  - 기반 lib: src/theme/tokens.ts (디자인 토큰), src/lib/date.ts (dayjs Asia/Seoul 래퍼), src/lib/supabase.ts (청크 SecureStore 어댑터), src/lib/queryClient.ts
  - tsc --noEmit 통과. package.json에 typecheck 스크립트 추가.
  - Node: brew node@22 설치는 네트워크(brew CDN) 차단으로 실패 → Node v25로 진행(정상 동작). 버전 무관 결정(사용자 승인).
- [x] **M0-2 앱 뼈대(일부)**:
  - 데모 화면/컴포넌트 제거, expo-router 구조로 재구성: `(tabs)` 5탭(표지/달력/위키/정산/나) + `(auth)` sign-in/join
  - 루트 _layout에 QueryClientProvider + SafeAreaProvider + GestureHandlerRootView 배선
  - 기초 컴포넌트: Text(변형 프리셋)·Screen·Button·Card·SectionHeader (전부 tokens 기반)
  - 표지/달력 화면에 토큰 색 반영한 플레이스홀더(범례 등). tsc 통과.
  - CI 워크플로에 EXPO_TOKEN 없으면 스킵(초록) 가드 추가 → 더 이상 빨갛게 실패 안 함
- [x] **M0-2b 폰트 + Wanted Sans 홈 디자인 반영 (ADR-008)**:
  - 방향 피벗: 명조 월간지 → Wanted Sans 하이에너지 (design/ 번들 기준). tokens.ts 재작성(폰트/라운드/파생색).
  - 폰트 프리로드(expo-font useFonts + 스플래시 게이팅): Big Shoulders Display(초대형 D-day)·IBM Plex Mono(숫자)·Noto Serif KR(표지 감성)·Noto Sans KR(Wanted Sans/Pretendard 스탠드인)
  - 홈(표지) hifi 재구성: 브랜드 헤더 + 다크 D-day 히어로 카드 + 참석/불참 + 일정카드(아바타 스택) + 최근 목록
  - Button hifi(높이48/라운드14), Text 프리셋 재정의. tsc 통과 + `expo export -p ios` 번들 성공(3.8MB)
  - 감성 포인트(표지/과월호)는 명조+neon 예약. 후속: 라이선스 Wanted Sans/Pretendard 번들 + CJK subset
- [x] **로컬 폰트 적용**: 사용자가 `fonts/`에 넣은 **Jalnan2**(브랜드 워드마크/대형 타이틀)·**JalnanGothic**(제목 h1/h2/눈썹) 번들 → tokens.fonts 갱신. 본문=Noto Sans KR 유지.
- [x] **1번 — 나머지 화면 hifi 재구성**:
  - 달력: 6칸 게이지 월 그리드(시그니처2) + 월 이동 + 요일 헤더 + 전원가능 neon 반전 + 하단 요약 (GaugeCell 컴포넌트, monthGrid 사용, 플레이스홀더 집계)
  - 로그인/가입: Jalnan2 워드마크 하이에너지 화면
  - 정산/나: 디자인 시스템 컴포넌트라 새 폰트 자동 반영(일관 유지)
- [x] **로고 SVG 반입**: react-native-svg + svg-transformer(metro.config.js) → assets/gcu.svg → `Logo` 컴포넌트. 홈·로그인에 적용.
- [x] **M0-3 Supabase 스키마(파일)**: `supabase/migrations/0001_init_members_invites.sql`(members·invite_codes·6인 트리거·RLS·is_active_member/is_admin 헬퍼·컬럼권한) + `supabase/functions/join/index.ts`(코드검증→계정생성→멤버등록→코드소모, 항상 200+ok) + `supabase/SETUP.md`(적용·부트스트랩 절차)
- [x] **M0-4 인증 클라이언트**: AuthContext(세션)·useProtectedRoute(게이팅)·api/auth·api/members·TextField·실제 로그인/가입 폼·me 프로필+로그아웃. devStore.previewMode로 백엔드 전 둘러보기 우회.
- [ ] **사용자 액션 필요(M0-3/4 활성화)**: `supabase/SETUP.md` 따라 (1)`db push` (2)`functions deploy join` (3)관리자 부트스트랩 SQL. 그래야 실제 로그인/가입 동작.
- [ ] 라이선스 Wanted Sans/Pretendard 번들 + CJK subset(용량) — 현재 Jalnan(로컬)+Noto(Google)
- [ ] previewMode 우회 제거(백엔드 실사용 후)
- [~] **M0-5 배포/CI (진행 중)**:
  - [x] `eas.json`(dev/preview=internal APK, production) + `eas init`(projectId 2af27595...) + `eas update:configure`(expo-updates, updates.url)
  - [x] `eas build -p android --profile preview` **완료** — APK: https://expo.dev/artifacts/eas/d7g0VXksinb5kn4YXmdWSxPBVFa2yraiJCmS3bKFTOc.apk (빌드 ef3d69c4). preview 채널 → CI OTA 자동수신. 6명 설치=서버·Wi-Fi 불필요, LTE 사용.
  - [x] **CI 활성화 완료(태스크 #6)**: EXPO_TOKEN secret 등록됨 → push→`eas update` OTA **자동배포 초록 검증**(run 30243073757 success). ⚠️ 토큰이 채팅에 노출돼 재발급 권장.
  - [x] web.output `static`→`single` (eas update 웹 정적렌더 실패 수정)
- 참고: LTE 개발 미리보기는 사용자 터미널에서 `npx expo start --tunnel` (샌드박스에선 ngrok 차단으로 실패)
- [ ] M0-3 Supabase: 0001 마이그레이션(members/invite_codes/6인 트리거/RLS) + join Edge Function + 관리자 seed
- [ ] M0-4 인증: supabase.auth 연결(sign-in/join 실제 동작) + 세션 게이팅 + me 프로필

## 확정 사항 요약 (자세히는 ADR)
- 앱 이름 **월간gcu** / Expo owner `yunhu` / slug `gcuschedule` / scheme `gcuschedule` / bundle `com.yunhu.gcuschedule`
- Expo 프로젝트: https://expo.dev/accounts/yunhu/projects/gcuschedule (생성 완료)
- Supabase: ref `mbpvftoowisrpqgjkidw`, URL/publishable키는 `.env`에 저장(커밋 안 됨). 값은 `.env.example` 형식 참고.
- iOS+Android 동시, Expo 크로스플랫폼
- Supabase 백엔드
- 이메일+비번 로그인, 닉네임+프사, 초대코드 가입
- 모임 주기 유동적 (meetups에 year+month 유니크 없음)
- 가용성 하루 단위 + 메모

## 다음에 할 일 (순서대로)
1. [x] git init + GitHub 연동 + CI 워크플로 준비
2. [x] **M0-0 계정 준비 완료**: Expo 프로젝트 `gcuschedule` + Supabase 프로젝트 `mbpvftoowisrpqgjkidw` (URL·키 `.env` 저장, 검증됨)
3. **[승인 대기] M0-1**: `create-expo-app` (TS, expo-router), SDK 핀, ESLint/Prettier, 핵심 라이브러리 설치  ← **다음**
3. M0-2: tokens.ts + 폰트 + 기초 컴포넌트 + date.ts/supabase.ts + 라우팅 뼈대
4. M0-3: Supabase 프로젝트 + `0001_members_invites.sql` + 6인 트리거 + RLS + join Edge Function
5. M0-4: sign-in / join / 세션 유지 / me 탭
6. M0-5: eas.json + Android APK 내부 배포 1회

## CI/CD 자동 배포 — M0에서 켤 때 필요한 수동 작업
- expo.dev에서 `EXPO_TOKEN` 발급 (Expo 계정 로그인 필요 — 사용자 직접)
- `gh secret set EXPO_TOKEN --repo yunhu0110/gcu_schedule` 로 등록
- 앱 스캐폴딩 + `eas init` 완료되면 push 시 워크플로가 자동으로 `eas update` 실행

## 열린 질문 (미결정 — 해당 시점에 사용자에게 질문)
- iOS 배포 비용(Apple Developer Program) — M1 iOS 배포 시점
- 모임장 로테이션 규칙(Q5) / 모임장 권한 범위(Q7) — M1
- 회비·불참비(Q8·Q9) — M3 정산
- 위키 삭제 권한(Q12) — M2 위키

## 메모 / 주의
- 날짜: `YYYY-MM-DD` 문자열 + `date` 타입, 타임존 변환 금지. 유틸은 `src/lib/date.ts`만.
- service_role key 절대 커밋/EAS 금지. 클라이언트는 anon key(`EXPO_PUBLIC_`)만.
- 커밋 전 `npx tsc --noEmit`.
