# 사용법

이 폴더를 새 Expo 프로젝트 루트에 그대로 복사한다.

```
프로젝트루트/
├─ CLAUDE.md            ← 클로드 코드가 매 세션 자동으로 읽는다
├─ docs/                ← 01~08. 작업 종류에 따라 골라 읽힌다
└─ .claude/agents/      ← 8개 서브에이전트
```

## 순서
1. `docs/08-OPEN-QUESTIONS.md`의 **1~4번(앱 이름 / iOS 배포 / 백엔드 / 로그인)을 먼저 결정**한다.
   이 네 개가 안 정해지면 첫 커밋부터 되돌려야 한다.
2. `npx create-expo-app` 후 이 파일들을 넣고 `git init`.
3. 클로드 코드에서:
   - `product-planner 에이전트로 M0 작업을 세분화해줘`
   - `supabase-engineer 에이전트로 members / invite_codes 마이그레이션과 RLS를 만들어줘`
   - `ui-ux-designer 에이전트로 tokens.ts와 기본 컴포넌트를 만들어줘`
4. 기능 하나를 끝낼 때마다 `qa-reviewer 에이전트로 리뷰해줘`.
5. `release-manager 에이전트로 안드로이드 내부 배포 빌드를 잡아줘` — 배포 경로는 M0에서 미리 뚫어둔다.

## 에이전트
| 이름 | 역할 |
|---|---|
| `product-planner` | 범위·우선순위 판단, ADR 기록 |
| `ui-ux-designer` | 월간지 컨셉 수호, 토큰·화면·문구 |
| `expo-engineer` | RN/Expo 구현 |
| `supabase-engineer` | 스키마·마이그레이션·RLS |
| `schedule-logic` | 가용성 집계·추천·날짜 버그 |
| `wiki-engineer` | 문서 트리·리비전·검색 |
| `qa-reviewer` | 리뷰, RLS 침투 확인 |
| `release-manager` | EAS 빌드·OTA·TestFlight |

## 문서를 살아 있게 유지하는 규칙
스펙과 코드가 어긋나면 **코드보다 문서를 먼저** 고친다.
결정할 때마다 `docs/08-OPEN-QUESTIONS.md` 하단 ADR에 한 줄 남긴다. 이게 없으면 3개월 뒤에 같은 논의를 반복한다.
