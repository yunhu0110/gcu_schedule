# CLAUDE.md — 모임 앱 (코드네임: `moim-six`)

## 프로젝트 한 줄 정의
**6인 고정 멤버 소모임용 모바일 위키 + 일정 조율 앱.**
컨플루언스처럼 기록이 쌓이고, 매달 모임장이 "표지"를 장식하는 월간지 컨셉.

## 대전제 (설계 판단이 갈릴 때 여기로 돌아온다)
1. **사용자는 정확히 6명.** 확장·성장·다중 그룹은 고려하지 않는다. 스케일 대비 설계(샤딩, 캐시 계층, 멀티테넌시)는 전부 오버엔지니어링.
2. **스토어 배포 없음.** Expo/EAS 내부 배포로 상시 운영. 심사 대응 코드·정책 화면(개인정보처리방침 링크 등)은 최소만.
3. **UI/UX가 이 앱의 존재 이유.** 기능이 하나 늦게 나오는 것보다 화면이 촌스러운 게 더 큰 실패.
4. **기록은 지워지지 않는다.** 위키 문서와 모임 기록은 리비전으로 보존한다. 6명의 히스토리가 이 앱의 자산.

## 기술 스택 (고정)
- **앱**: Expo (React Native) + TypeScript + `expo-router`
- **상태/데이터**: TanStack Query (서버 상태) + Zustand (로컬 UI 상태, 최소한만)
- **백엔드**: Supabase (Postgres + Auth + RLS + Realtime + Storage)
- **날짜**: `dayjs` + `dayjs/plugin/timezone`, 타임존 `Asia/Seoul` 고정
- **애니메이션**: `react-native-reanimated`
- **푸시**: `expo-notifications` (→ Expo Go 불가, development build 필요)

> SDK 버전은 프로젝트 생성 시점 최신으로 **핀 고정**한다. 임의 업그레이드 금지.
> 라이브러리를 추가할 때는 Expo 호환성(New Architecture 지원 여부)을 먼저 확인한다.

## 문서 맵 — 작업 시작 전 해당 문서를 먼저 읽는다
| 파일 | 언제 읽나 |
|---|---|
| `docs/01-PRD.md` | 기능 범위·우선순위를 판단할 때 |
| `docs/02-DATA-MODEL.md` | DB, 쿼리, RLS를 건드릴 때 |
| `docs/03-UI-UX-GUIDE.md` | 화면·컴포넌트·스타일 코드를 쓸 때 (토큰 외 하드코딩 금지) |
| `docs/04-SCREENS.md` | 특정 화면을 구현할 때 |
| `docs/05-SCHEDULING-LOGIC.md` | 가용성 입력·집계·추천 로직을 건드릴 때 |
| `docs/06-DEPLOYMENT.md` | 빌드/배포/OTA 작업을 할 때 |
| `docs/07-ROADMAP.md` | "다음에 뭐 하지"일 때 |
| `docs/08-OPEN-QUESTIONS.md` | 결정되지 않은 사항을 만났을 때 (**추측하지 말고 여기 추가하고 질문**) |

## 절대 규칙
### 날짜 (가장 사고 많이 나는 지점)
- 날짜는 `YYYY-MM-DD` **문자열**로 다루고, DB 컬럼은 `date` 타입. `timestamptz` 쓰지 않는다.
- `new Date("2026-08-01")`은 UTC로 파싱되어 한국에서 7월 31일이 된다. **금지.**
  반드시 `dayjs.tz("2026-08-01", "Asia/Seoul")` 또는 문자열 그대로 비교.
- 월 경계 계산은 직접 하지 말고 `dayjs().startOf("month")` 사용.

### 보안
- 클라이언트에는 Supabase **anon key만**. `service_role` key는 절대 앱 코드/EAS 환경변수에 넣지 않는다.
- 모든 테이블은 RLS **활성화 후** 정책 작성. "6명뿐이니까 다 열어두자" 금지 — 최소한 본인 데이터 쓰기 제한은 DB에서 막는다.
- 6인 정원 제한은 클라이언트 검증이 아니라 **DB 트리거**로 강제.

### 코드
- 컴포넌트는 함수형 + hooks. 파일당 1 컴포넌트.
- 색상·간격·폰트는 `theme/tokens.ts`에서만 가져온다. 리터럴 hex 금지.
- 서버 데이터 접근은 `src/api/*.ts`의 쿼리 함수를 통해서만. 컴포넌트에서 `supabase.from()` 직접 호출 금지.
- 텍스트는 `src/i18n/ko.ts`에 모은다 (다국어 계획은 없지만 문구 일관성 관리용).

## 디렉터리 구조
```
app/                 # expo-router 라우트
  (tabs)/            # 표지 / 달력 / 위키 / 정산 / 나
src/
  api/               # supabase 쿼리 함수
  components/        # 재사용 UI
  features/          # 도메인별 (host, availability, wiki, settlement)
  hooks/
  theme/tokens.ts    # 디자인 토큰 (단일 출처)
  lib/date.ts        # dayjs 래퍼 — 날짜 유틸은 전부 여기
supabase/
  migrations/        # SQL 마이그레이션 (순번 접두사)
docs/
.claude/agents/
```

## 자주 쓰는 명령
```bash
npx expo start                      # 개발 서버
npx expo start --dev-client         # development build로 접속
npx tsc --noEmit                    # 타입 체크 (커밋 전 필수)
npx eslint . --fix
npx supabase db push                # 마이그레이션 적용
eas build --profile preview --platform android
eas update --branch preview -m "메시지"
```

## 작업 방식
- 기능 하나 = 브랜치 하나. 커밋 메시지는 `feat|fix|docs|refactor|chore: 한국어 요약`.
- **DB 스키마 변경은 항상 마이그레이션 파일로.** 대시보드에서 직접 수정 금지.
- 스펙과 코드가 어긋나면 코드를 고치기 전에 `docs/`를 먼저 갱신한다.
- 결정이 필요한 애매한 지점은 임의 결정하지 않고 `docs/08-OPEN-QUESTIONS.md`에 적고 사용자에게 묻는다.

## 에이전트
`.claude/agents/` 참조. 요약:
`product-planner`(스펙·결정 기록) · `ui-ux-designer`(디자인 토큰·화면) · `expo-engineer`(앱 구현) ·
`supabase-engineer`(스키마·RLS) · `schedule-logic`(가용성 알고리즘) · `wiki-engineer`(문서·리비전) ·
`qa-reviewer`(리뷰·RLS 검증) · `release-manager`(EAS 빌드·배포)
