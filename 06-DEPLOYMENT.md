# 06. 배포 전략 (스토어 없이 6명에게 상시 배포)

> ⚠️ Apple / Google / Expo의 정책·요금·만료 기간은 바뀐다.
> 실제 진행 전에 각 공식 문서에서 현재 값을 확인하고 이 문서를 갱신할 것.

## 결론 먼저
| 대상 | 방식 |
|---|---|
| 개발 중 | Expo Go 또는 development build + `npx expo start` |
| Android 5명 배포 | **EAS Build 내부 배포(APK)** → 링크로 설치 |
| iOS 1명 배포 | **PWA (웹앱)** — GitHub Pages + "홈 화면에 추가". 무료·무만료 (★ADR-014) |
| 기능 업데이트 | **EAS Update (OTA)** — JS·이미지 변경은 빌드 없이 즉시 반영 (웹은 새로고침) |

## 1. Expo Go로는 끝까지 갈 수 없다
Expo Go는 개발 서버가 켜져 있어야 하고, 커스텀 네이티브 모듈과 푸시 알림에 제약이 있다.
6명이 평소에 쓰는 앱이 되려면 **각자 기기에 실제 앱이 설치돼 있어야** 한다.
→ 초기 개발은 Expo Go로 빠르게, 푸시 붙이는 시점부터 development build로 전환.

## 2. Android
```bash
eas build --profile preview --platform android   # APK 산출
```
- `eas.json`의 `preview` 프로필에 `"distribution": "internal"`, `"android": { "buildType": "apk" }`.
- 빌드 완료 후 나오는 링크/QR을 단톡방에 공유 → 각자 설치.
- 기기에서 "알 수 없는 출처 앱 설치 허용"을 한 번 켜야 한다. 안내 문구를 미리 준비.
- 만료 없음. 네이티브 변경이 없으면 이후엔 OTA만으로 충분.

## 3. iOS — 세 가지 길 (현재 채택: C)

### (C) PWA 웹앱 ← **현재 이걸로 운영** (★ADR-014)
아이폰 사용자가 1명뿐이라 유료 멤버십 없이 간다.

```bash
npm run fonts:web   # 폰트 원본이 바뀐 경우에만 (결과물은 저장소에 커밋되어 있다)
npm run build:web   # expo export -p web + PWA 후처리
```

- **배포 URL**: https://yunhu0110.github.io/gcu_schedule/
- **배포 방식**: `.github/workflows/deploy-web.yml`이 `feat/pwa-web` push 시 자동 배포.
  Pages Source는 "GitHub Actions"로 설정되어 있다.
- **설치 방법(사용자 안내)**: 사파리로 URL 접속 → 공유 버튼 → **"홈 화면에 추가"**.
  이후 홈 화면 아이콘으로 주소창 없는 전체화면 실행.
- **필요한 시크릿**: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (등록 완료).

**웹에서만 갈라지는 구현**
| 항목 | 네이티브 | 웹 |
|---|---|---|
| 세션 저장 | SecureStore(키체인) | localStorage (`src/lib/storage.web.ts`) |
| 폰트 | TTF 번들 | 서브셋 woff2 2.5MB (`src/theme/fonts.web.ts`) |
| 배포일 표시 | `Updates.createdAt` | 빌드 시각(`EXPO_PUBLIC_BUILD_DATE`) |
| 업데이트 | EAS Update(OTA) | 새로고침 |
| 푸시 | expo-notifications(예정) | 불가 — 인앱 알림만 |

> **폰트 주의**: 원본 TTF를 그대로 웹에 올리면 32MB다. `scripts/subset-web-fonts.mjs`가
> 한글 완성형 전체를 유지한 채 woff2로 줄여 2.5MB로 만든다. 결과물 `public/fonts/*.woff2`는
> 저장소에 커밋되어 있으므로, **폰트를 교체하면 스크립트를 다시 돌려 커밋**할 것.

> **하위경로 주의**: Pages가 `/gcu_schedule/` 아래에 서비스하므로 `app.json > experiments.baseUrl`이
> 필요하다. 이 값이 없으면 JS 번들 경로가 404가 난다. 커스텀 도메인을 붙이면 이 값을 비워야 한다.

### (A) TestFlight 내부 테스터 ← 아이폰 사용자가 늘면 이쪽
- **Apple Developer Program 유료 멤버십 필요.**
- 내부 테스터로 6명 초대(이메일 기준). 내부 테스팅은 별도 심사 대기가 없다.
- **빌드에 만료 기한이 있다(약 90일).** 만료되면 새 빌드를 올려야 계속 설치·실행 가능.
  → 분기마다 `eas build` + `eas submit` 한 번. 캘린더에 반복 일정으로 걸어둘 것.
- 장점: UDID 수집 불필요, 설치 경험이 깔끔, 업데이트 배포도 쉽다.

### (B) 애드혹 내부 배포
```bash
eas device:create      # 각 기기 UDID 등록
eas build --profile preview --platform ios
```
- 등록된 기기에서만 실행. 6명 UDID를 한 번 모아야 한다.
- 프로비저닝 프로파일/인증서 만료 주기(보통 1년)에 맞춰 재빌드.
- 장점: 90일 재빌드 부담이 없다. 단점: 초기 세팅과 기기 교체 대응이 번거롭다.

> 무료 개인 계정으로 로컬 서명하는 방법은 며칠 만에 만료되므로 6명 운영에는 부적합.

## 4. OTA 업데이트 (핵심 운영 수단)
```bash
eas update --branch preview -m "달력 게이지 수정"
```
- JS / 이미지 / 설정 변경은 재빌드 없이 반영된다. 앱을 껐다 켜면 적용.
- **네이티브가 바뀌면 반드시 새 빌드**: 라이브러리 추가·SDK 업그레이드·권한 추가·앱 아이콘/스플래시 변경.
- `app.json`에 `runtimeVersion: { "policy": "appVersion" }`을 두고, 네이티브 변경 시 `version`을 올린다.
  이렇게 하면 구버전 앱에 호환되지 않는 업데이트가 내려가는 사고를 막는다.
- 채널: `preview`(6명 실사용) / `dev`(내가 먼저 확인). 위험한 변경은 `dev`로 먼저 올리고 확인 후 승격.
- 롤백: `eas update:rollback` 또는 직전 커밋 재배포. 문제 생기면 되돌리는 게 고치는 것보다 빠르다.

### 4-1. git push → EAS Update 자동화 (CI/CD)  ★ADR-007
`main`에 push하면 GitHub Actions가 `eas update`를 실행해 OTA를 자동 배포한다.
- 워크플로: `.github/workflows/eas-update.yml`
- **트리거**: `app/**`, `src/**`, `assets/**`, `package.json`, `app.json`, `eas.json` 변경 시에만.
  → 문서만 고친 push는 배포를 트리거하지 않는다. (Expo 앱 생성 전에도 실패하지 않도록 하는 안전장치)
- **활성화에 필요한 것 (M0에서 충족)**:
  1. Expo 앱 + `eas init`(EAS 프로젝트 ID) + `eas.json`
  2. GitHub 저장소 **Secrets에 `EXPO_TOKEN`** 등록
     - expo.dev → Account settings → Access tokens에서 발급 (Expo 계정 로그인 필요, 사용자가 직접)
     - `gh secret set EXPO_TOKEN --repo yunhu0110/gcu_schedule` 로 등록 가능
- **네이티브 변경은 자동화하지 않는다.** OTA로 안 되는 변경(라이브러리 추가·SDK 업글·권한·아이콘)은
  이 파이프라인이 아니라 `eas build`(수동)로 새 빌드를 올린다. 무료 플랜 빌드 한도·큐 때문에 자동 빌드는 지양.
- 배포 채널은 `preview`(6명 실사용) 고정. 위험한 변경은 `dev` 채널로 수동 확인 후 승격.

## 5. 푸시 알림
- `expo-notifications` + Expo Push Service.
- **development build 이상에서만 동작.** Expo Go에서는 테스트 불가.
- iOS는 APNs 키, Android는 FCM 설정 필요 → `eas credentials`로 관리.
- 토큰은 로그인 직후 `push_tokens`에 저장, 로그아웃 시 삭제.
- 발송은 Supabase Edge Function 또는 `pg_cron` 스케줄에서 Expo Push API 호출.

## 6. 환경 변수 / 시크릿
- 클라이언트에 들어가도 되는 값만 `EXPO_PUBLIC_` 접두사 (Supabase URL, anon key).
- `service_role` key, APNs 키, Expo 토큰은 EAS 환경 변수/시크릿에만. **저장소에 커밋 금지.**
- `.env*`, `google-services.json`, `*.p8`, `*.mobileprovision`을 `.gitignore`에 추가.

## 7. 버전 관리
- `version`: 사용자에게 보이는 앱 버전. 네이티브 변경 시 올린다.
- `android.versionCode` / `ios.buildNumber`: `eas.json`의 `autoIncrement`로 자동 증가.
- 릴리즈마다 `CHANGELOG.md`에 한 줄. 6명에게 뭐가 바뀐지 알려줄 근거가 된다.

## 8. 운영 체크리스트
- [ ] EAS 무료 플랜의 빌드 횟수·큐 대기 제한 확인 (많이 빌드할 달에는 병목이 된다)
- [ ] Supabase 무료 프로젝트는 **일정 기간 미사용 시 일시정지**될 수 있음 → 6명이 매일 쓰지 않는다면 확인 필요
- [ ] Storage 용량(사진 업로드) 한도 확인, 업로드 전 이미지 리사이즈
- [ ] DB 백업: 무료 플랜 백업 정책 확인 후, 부족하면 월 1회 `pg_dump` 수동 백업 루틴
- [ ] iOS 빌드 만료 재빌드 반복 일정 등록
- [ ] Sentry 등 에러 수집 (6명이라 로그가 없으면 원인 파악이 불가능하다)
