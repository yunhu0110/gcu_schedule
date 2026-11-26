-- 0029 · 보드게임 탭에 '히든 워드' 카드 등록
-- 히든 워드는 별도 웹앱(apps/hidden-word)으로 GitHub Pages 하위경로에 배포됨.
-- 카드 소유자(member_id)는 활성 운영자로 자동 지정. url 기준 멱등(중복 삽입 방지).
-- 썸네일은 Pages 공개 경로(hidden-word/hidden-word-thumb.jpg)를 직접 참조 — covers 버킷 불필요.

insert into public.games (member_id, title, url, description, genre, thumbnail_url)
select m.id,
       '히든 워드',
       'https://yunhu0110.github.io/gcu_schedule/hidden-word/',
       '단어 힌트로 비밀 단어를 맞히는 실시간 파티게임',
       '실시간 추리',
       'https://yunhu0110.github.io/gcu_schedule/hidden-word/hidden-word-thumb.jpg'
from public.members m
where m.is_admin and m.is_active
  and not exists (
    select 1 from public.games g
    where g.url = 'https://yunhu0110.github.io/gcu_schedule/hidden-word/'
  )
limit 1;
