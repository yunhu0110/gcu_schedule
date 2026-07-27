# Supabase 적용 가이드 (M0-3)

> 코드/앱에는 anon(publishable) 키만. **service_role / sb_secret_ 키는 저장소·앱에 절대 넣지 않는다.**
> Edge Function은 service_role를 런타임이 자동 주입하므로 우리가 넣을 필요 없다.

## 0. Supabase CLI 준비
```bash
npx supabase --version         # 없으면 자동 설치
npx supabase init              # config.toml 생성 (기존 migrations/functions 유지됨)
npx supabase login             # 액세스 토큰으로 로그인 (브라우저)
npx supabase link --project-ref mbpvftoowisrpqgjkidw   # DB 비밀번호 물어봄
```

## 1. 스키마 적용 (마이그레이션)
```bash
npx supabase db push           # migrations/0001_init_members_invites.sql 적용
```
> CLI가 어려우면 임시로 대시보드 SQL Editor에 `migrations/0001_init_members_invites.sql`를
> 붙여넣어 실행해도 된다. **단, 파일이 진실의 출처**이므로 대시보드에서 임의 수정 금지.

## 2. join Edge Function 배포
```bash
npx supabase functions deploy join
```
- service_role/URL은 Edge 런타임이 자동 주입하므로 별도 시크릿 설정 불필요.
- 클라이언트는 `supabase.functions.invoke('join', { body: {...} })`로 호출한다(M0-4).

## 3. 관리자 부트스트랩 (첫 사용자 — 1회, 닭-달걀 해소)
가입은 초대 코드가 필요하고 코드는 관리자만 발급 → **첫 관리자는 초대 흐름을 건너뛰고 직접 심는다.**

1. 대시보드 **Authentication → Users → Add user**로 관리자 계정 생성(이메일/비번, "Auto Confirm").
   생성된 사용자의 **UID**를 복사.
2. SQL Editor(또는 psql)에서 아래 실행 (UID·닉네임 교체):
```sql
insert into public.members (id, nickname, is_admin)
values ('<복사한-UID>', '관리자닉네임', true);

-- 나머지 5명에게 줄 1회용 초대 코드 발급 (원하는 코드 문자열로)
insert into public.invite_codes (code, created_by) values
  ('GCU-A1', '<복사한-UID>'),
  ('GCU-B2', '<복사한-UID>'),
  ('GCU-C3', '<복사한-UID>'),
  ('GCU-D4', '<복사한-UID>'),
  ('GCU-E5', '<복사한-UID>');
```
3. 이제 앱에서 관리자 이메일/비번으로 **로그인**, 나머지 5명은 발급된 코드로 **가입**하면 된다.

## 검증 체크리스트
- [ ] `members` 활성 6명 도달 시 6번째 초과 insert가 트리거로 막히는가
- [ ] 비관리자가 `invite_codes`를 못 읽는가(RLS)
- [ ] 본인 아닌 멤버의 nickname을 수정 못 하는가(RLS + 컬럼 권한)
- [ ] 이미 쓴 코드/만료 코드로 가입이 거부되는가(join)
