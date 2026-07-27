# Supabase 적용 가이드 (단순 회원가입, ADR-009)

> 코드/앱에는 anon(publishable) 키만. **service_role / sb_secret_ 키는 저장소·앱에 절대 넣지 않는다.**
> 초대코드/Edge Function은 폐지했다. 가입은 앱의 `auth.signUp` → `members` insert로 끝난다.

## 0. .env (로컬 개발 접속값)
프로젝트 루트에 `.env`(git 커밋 안 됨)를 만들고 대시보드 **Settings → API** 값을 채운다:
```
EXPO_PUBLIC_SUPABASE_URL=https://mbpvftoowisrpqgjkidw.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon / publishable 키>
```

## 1. 이메일 확인(Confirm email) 끄기 — 단순 가입 전제
대시보드 **Authentication → Sign In / Providers → Email** 에서 **"Confirm email" OFF**.
> 이걸 켜두면 `signUp` 직후 세션이 안 생겨서 `members` insert가 RLS에 막힌다(가입이 반쪽으로 끝남).
> 본인인증 없는 6인 지인 모임이므로 OFF가 맞다(ADR-009).

## 2. 스키마 적용 (마이그레이션)
- **신규(빈) DB**: `0001_init_members.sql` → `0002_simple_signup.sql` 순서로 적용.
- **현재 hosted DB(`mbpvftoowisrpqgjkidw`)**: 구 스키마(members + invite_codes)가 이미 적용돼 있으므로 **`0002_simple_signup.sql`만** 적용하면 단순 가입으로 전환된다(members self-insert 정책 추가 + invite_codes 제거).

CLI가 있으면:
```bash
npx supabase link --project-ref mbpvftoowisrpqgjkidw   # DB 비밀번호 물어봄
npx supabase db push
```
CLI가 어려우면 대시보드 **SQL Editor**에 해당 `.sql` 파일 내용을 붙여넣어 실행한다.
> **파일이 진실의 출처.** 대시보드에서 임의 수정 금지(스키마 변경은 항상 새 마이그레이션 파일로).

## 3. 관리자 부트스트랩 (개발자 본인 — 1회)
관리자 지정은 클라이언트에서 불가(컬럼 권한에서 is_admin 제외). 아래로 심는다:
1. 앱에서 **본인 계정으로 그냥 가입**(닉네임/이메일/비번). → `members` 행 자동 생성됨.
2. 대시보드 **SQL Editor**에서 본인 행에 관리자 플래그:
```sql
update public.members set is_admin = true
where id = (select id from auth.users where email = '<본인 이메일>');
```
3. 나머지 5명은 **앱 링크를 받아 각자 가입**하면 끝(코드 불필요).

## 검증 체크리스트
- [ ] `.env` 값으로 앱이 Supabase에 붙는가 (로그인 화면 로딩)
- [ ] 가입 → 곧바로 홈으로 이동하고 `members`에 행이 생기는가
- [ ] 활성 6명 도달 시 7번째 가입이 트리거로 막히고 "정원이 가득 찼어요" 문구가 뜨는가
- [ ] 본인 아닌 멤버의 nickname을 수정 못 하는가(RLS + 컬럼 권한)
- [ ] 클라이언트에서 is_admin/is_active를 못 바꾸는가(컬럼 권한 제외)
