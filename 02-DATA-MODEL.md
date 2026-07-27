# 02. 데이터 모델 (Supabase / Postgres)

> 원칙: 6명 단일 그룹이므로 `group_id` 없음. 필요해지면 그때 추가한다.
> 모든 테이블 RLS 활성화. 날짜는 `date`, 시각은 `timestamptz`.

## 테이블

### `members`
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | `auth.users.id` 참조 |
| nickname | text NOT NULL | 표시 이름 |
| avatar_url | text | Storage 경로 |
| is_active | boolean default true | 탈퇴 시 false (행 삭제 금지 — 기록 보존) |
| is_admin | boolean default false | 1명만 |
| joined_at | timestamptz default now() | |

**정원 트리거 (6인 하드 제한)**
```sql
create or replace function enforce_member_limit() returns trigger as $$
begin
  if (select count(*) from members where is_active) >= 6 then
    raise exception '정원이 가득 찼습니다 (6명)';
  end if;
  return new;
end $$ language plpgsql;

create trigger trg_member_limit before insert on members
for each row execute function enforce_member_limit();
```

### ~~`invite_codes`~~ — 폐지 (ADR-009)
초대코드/`join` Edge Function은 제거한다. 가입은 `supabase.auth.signUp` 후 앱이 직접 `members` 행을 insert하며, 정원은 트리거로, 소유권은 RLS(`id = auth.uid()`)로 강제한다.

**members self-insert 정책 (ADR-009)**
```sql
-- 가입: 본인 id로만 members 행 생성. 정원 초과는 trg_member_limit 트리거가 막는다.
create policy members_insert_self on public.members
  for insert with check (id = auth.uid());
grant insert (id, nickname, avatar_url) on public.members to authenticated;
```

### `hosts` — 월별 모임장
`id uuid PK` · `year int` · `month int` · `member_id uuid` · `cover_message text` · `theme_color text` · `cover_image_url text`
- `unique (year, month)`
- 표지 화면의 유일한 데이터 소스.

### `availabilities` — 가용성 ★
`id uuid PK` · `member_id uuid` · `date date` · `status availability_status` · `note text` · `updated_at timestamptz`
- `create type availability_status as enum ('available','unavailable','maybe');`
- `unique (member_id, date)` — upsert로 갱신
- `index (date)` — 월 범위 조회용
- **행이 없으면 `미입력`.** `maybe`(미정)와 미입력은 다른 상태다. 절대 같게 취급하지 않는다.

### `recurring_blocks` — 상시 불가 규칙
`id uuid PK` · `member_id uuid` · `weekday int (0=일)` · `note text` · `active boolean`
> 집계 시 같은 날짜에 `availabilities` 행이 있으면 그것이 우선한다(개별 입력 > 반복 규칙).

### `meetups`
`id uuid PK` · `cycle_year int` · `cycle_month int` · `host_id uuid` · `title text` · `status meetup_status` ·
`confirmed_date date null` · `start_time time null` · `place_name text` · `place_url text` ·
`lat numeric null` · `lng numeric null` · `budget_per_person int null` · `wiki_page_id uuid null` · `created_at`
- `create type meetup_status as enum ('draft','voting','confirmed','done','cancelled');`
- **ADR-005**: `cycle_year`/`cycle_month`는 "어느 달의 호스트가 주관하는 모임인가"를 뜻한다.
  **`(cycle_year, cycle_month)` 유니크 제약을 걸지 않는다** — 실제 모임(`confirmed_date`)은 다음 달로 밀릴 수 있고, 한 호스트 주기에 모임이 여러 개일 수도 있다.
  호스트의 유일성은 `hosts (year, month)`에서만 보장한다.

### `date_candidates` / `date_votes`
- `date_candidates`: `id` · `meetup_id` · `date date`
- `date_votes`: `candidate_id` · `member_id` · `preference int (1~3)` · `unique(candidate_id, member_id)`

### `attendances`
`meetup_id` · `member_id` · `status enum('going','not_going','pending')` · `unique(meetup_id, member_id)`

### `wiki_pages`
`id uuid PK` · `parent_id uuid null` · `title text` · `body_md text` · `author_id` · `updated_by` ·
`updated_at` · `version int` · `is_pinned boolean` · `search_tsv tsvector generated`
- 트리 깊이는 **2단계까지만** (앱에서 검증).
- `create index on wiki_pages using gin(search_tsv);`

### `wiki_revisions`
`id` · `page_id` · `version int` · `title` · `body_md` · `edited_by` · `edited_at`
- **불변.** update / delete 정책을 만들지 않는다. `wiki_pages` update 트리거에서 이전 버전을 자동 적재.

### `comments` (ADR-010)
`id` · `target_type enum('wiki','meetup')` · `target_id uuid` · `parent_id uuid null` · `member_id` · `body text` · `created_at` · `deleted_at timestamptz null`
- **`parent_id`**: 대댓글용 self-ref. **깊이 1단계까지만**(대댓글에는 다시 대댓글 금지 — 앱에서 검증: `parent_id`가 있는 댓글에는 답글 불가). 최상위 댓글은 `parent_id = null`.
- 삭제는 행 제거 대신 `deleted_at` 세팅(대댓글이 매달린 부모 보존). 본문은 "삭제된 댓글"로 표시.
- 표시에는 `member_id`로 `members`(nickname, avatar_url) 조인 → 프사+닉네임.

### `notifications` (ADR-011) — 인앱 알림
`id uuid PK` · `recipient_id uuid` · `actor_id uuid null` · `type text` · `target_type text` · `target_id uuid` · `created_at timestamptz` · `read_at timestamptz null`
- 이벤트 발생 시 **행위자를 제외한 활성 멤버 전원에게 fan-out**(6명이라 부담 없음). 예: 위키 글 작성 → 나머지 5명에게 1행씩.
- `type` 예: `wiki_created` · `comment_added` · `meetup_confirmed` · `settlement_requested` ...
- 미읽음 배지 = `count(*) where recipient_id = auth.uid() and read_at is null`.
- 생성은 서버 트리거 또는 Edge Function(작성자 RLS로 남의 recipient 행을 못 만들게) — 상세는 M2 알림 착수 시 확정.

### `settlements` / `settlement_shares`
- `settlements`: `id` · `meetup_id` · `payer_id` · `total_amount int` · `memo` · `closed_at`
- `settlement_shares`: `settlement_id` · `member_id` · `amount int` · `paid_at timestamptz null`
- 금액은 **원 단위 정수**. 소수점/부동소수 금지. 나누어 떨어지지 않는 잔액은 결제자에게 몰아준다.

### `push_tokens`
`member_id` · `token text` · `platform text` · `updated_at` · `unique(member_id, token)`

### `notification_prefs`
`member_id PK` + 항목별 boolean 컬럼

## RLS 정책 기본형
```sql
-- 읽기: 활성 멤버는 모두 읽는다 (단일 그룹이므로)
create policy "member_read" on availabilities for select
  using (exists (select 1 from members m where m.id = auth.uid() and m.is_active));

-- 쓰기: 본인 것만
create policy "own_write" on availabilities for all
  using (member_id = auth.uid()) with check (member_id = auth.uid());
```

| 테이블 | 읽기 | 쓰기 |
|---|---|---|
| availabilities, push_tokens | 전체 | 본인만 |
| notification_prefs | 본인만 | 본인만 |
| hosts | 전체 | 해당 월 모임장(표지 필드만) + 관리자(로테이션) |
| meetups, date_candidates | 전체 | 해당 월 모임장 + 관리자 |
| date_votes, attendances | 전체 | 본인 행만 |
| wiki_pages, comments | 전체 | 전체 insert (본인 댓글만 수정/soft-delete) |
| notifications | 본인(recipient)만 | 읽음 처리(read_at)만 본인. insert는 트리거/서버 |
| wiki_revisions | 전체 | insert만 (트리거 전용) |
| settlements | 전체 | 모임장 또는 결제자 |
| members | 전체 | 본인 프로필 필드만. `is_admin`은 정책에서 제외해 아무도 못 쓰게 한다 |

## 헬퍼 함수 / 뷰
```sql
-- 이번 달 모임장인지
create function is_current_host(uid uuid) returns boolean ...

-- 월별 가용성 집계: 앱은 달력 화면에서 이 함수 하나만 호출한다
create function availability_summary(p_from date, p_to date)
returns table (
  d date, available_count int, unavailable_count int,
  maybe_count int, missing_count int, all_available boolean
);
```
- `current_host` 뷰: 오늘 기준 이번 달 모임장 + 멤버 조인 결과.

## 실시간
`availabilities`, `date_votes`만 Realtime 구독. 나머지는 pull-to-refresh로 충분하다.
