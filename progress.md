# progress.md — 월간gcu 진행 상황 (중간 세이브)

> 작업이 중단될 수 있으므로 **매 작업 후 이 파일을 갱신**한다.
> 새 세션은 이 파일 → `09-DEV-PLAN.md` → `08-OPEN-QUESTIONS.md` 순으로 읽고 이어간다.

**최종 갱신:** 2026-07-27
**현재 단계:** M0-2 앱 뼈대(라우팅+기초 컴포넌트) 완료. 앱 화면 확인 가능(`npx expo start`). 다음: 폰트 프리로드 + M0-3(Supabase 스키마) / M0-4(인증).

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
- [ ] **M0-2b 폰트 프리로드**: Noto Serif KR / Pretendard / IBM Plex Mono (expo-font). 지금은 시스템 폰트 + 굵기로 위계만  ← **다음**
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
