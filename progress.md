# progress.md — 월간gcu 진행 상황 (중간 세이브)

> 작업이 중단될 수 있으므로 **매 작업 후 이 파일을 갱신**한다.
> 새 세션은 이 파일 → `09-DEV-PLAN.md` → `08-OPEN-QUESTIONS.md` 순으로 읽고 이어간다.

**최종 갱신:** 2026-07-27
**현재 단계:** 기획 완료 + git 초기화·최초 커밋 완료. M0-1 Expo 스캐폴딩 승인 대기.

## 지금 어디까지 왔나
- [x] 기획 문서 8개(01~08) 정독
- [x] 4대 결정 확정 (ADR-001~006) → `08-OPEN-QUESTIONS.md` 기록
- [x] `02-DATA-MODEL.md`의 `meetups` 정의를 ADR-005(유동 주기)에 맞춰 갱신
- [x] `09-DEV-PLAN.md` 개발 기획서 작성
- [x] `progress.md` 생성
- [x] git init + .gitignore + 최초 커밋 (`main` 브랜치)
- [x] GitHub 원격 연동 (`origin` = yunhu0110/gcu_schedule, HTTPS, push 완료)
- [x] CI/CD 워크플로 준비 `.github/workflows/eas-update.yml` (ADR-007, dormant — M0에서 활성화)
- [ ] M0-1 Expo 스캐폴딩 (승인 후)  ← **다음**

## 확정 사항 요약 (자세히는 ADR)
- 앱 이름 **월간gcu** / Expo owner `yunhu` / slug `gcuschedule` / scheme `gcuschedule` / bundle `com.yunhu.gcuschedule`
- Expo 프로젝트: https://expo.dev/accounts/yunhu/projects/gcuschedule (생성 완료)
- iOS+Android 동시, Expo 크로스플랫폼
- Supabase 백엔드
- 이메일+비번 로그인, 닉네임+프사, 초대코드 가입
- 모임 주기 유동적 (meetups에 year+month 유니크 없음)
- 가용성 하루 단위 + 메모

## 다음에 할 일 (순서대로)
1. [x] git init + GitHub 연동 + CI 워크플로 준비
2. **[사용자] M0-0 계정 준비**: [x] Expo 프로젝트 `gcuschedule` 생성 완료. [ ] Supabase 프로젝트 생성(URL·anon key 확보) 남음
3. **[승인 대기] M0-1**: `create-expo-app` (TS, expo-router), SDK 핀, ESLint/Prettier, 핵심 라이브러리 설치
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
