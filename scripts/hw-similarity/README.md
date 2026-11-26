# 히든 워드 유사도 엔진 — 오프라인 적재 파이프라인

추측 단어 ↔ 출제자 히든워드의 유사도를 **서버(Postgres RPC `hw_similarity`)** 에서 계산한다.
이 디렉터리의 스크립트는 그 계산에 필요한 **사전계산 데이터**를 로컬에서 한 번 만들어 Supabase에 밀어넣는 용도다.
(앱 번들·EAS와 무관한 운영 도구. DB 커넥션 스트링은 환경변수로만 주입하고 절대 커밋하지 않는다.)

## 3축 분리 설계

| 축 | 신호 | 데이터 출처 | 저장 테이블 | 예시 |
|---|---|---|---|---|
| 1 의미 | fastText cosine | cc.ko.300 (CC-BY-SA 3.0) | `hw_word_vectors` | 나무↔소나무 ↑ |
| 2 문맥 | 위키 PPMI 공생 | kowiki 덤프 (CC-BY-SA) | `hw_word_cooc` | 나무↔버섯 ↑ |
| 3 관계 | 유의/반의/상·하위어 | ConceptNet5(CC-BY-SA 4.0) + OMW-ko | `hw_word_relations` | 뜨겁다↔차갑다 반의어 ↓ |

RPC는 세 축을 가중 블렌드(기본 0.55 / 0.20 / 0.25)해 0~100을 돌려준다.
반의어는 fastText 상 가깝지만 게임에선 '먼' 단어이므로 강하게 감점한다.

### 비대칭 구조 (중요)
유사도는 항상 **(히든워드 ∈ 풀 단어, 추측어 ∈ 자유 명사)** 쌍이다.
- **의미 축**: 양쪽 벡터가 필요 → 추측어까지 **대규모 명사 어휘**를 사전계산한다(“실시간 임의 단어 허용”의 실제 구현). 어휘에 없는 진짜 OOV는 의미 축이 빠지고 문맥·관계만으로 채점된다.
- **문맥·관계 축**: 한쪽이 **풀 단어인 항목만** 적재하면 충분 → 테이블이 작다.

데이터가 비어 있는 동안 `hw_similarity`는 `null`을 돌려주고, 게임 동작은 현행(점수 미표시)과 동일하다. 적재가 끝나면 자동으로 점수가 켜진다.

## 사전 준비

```bash
pip install -r requirements.txt
pip install wikiextractor          # 축2 전처리용
export SUPABASE_DB_URL='postgresql://postgres:...@db.mbpvftoowisrpqgjkidw.supabase.co:5432/postgres'
# (대시보드 > Project Settings > Database > Connection string. 앱 anon 키와 무관.)
```

마이그레이션 `0030`, `0031`이 먼저 적용돼 있어야 한다: `supabase db push --linked`.

## 실행 순서

```bash
# ── 축1 의미 ──────────────────────────────
# cc.ko.300.vec 다운로드(약 4.5GB 압축) 후 압축 해제
curl -O https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ko.300.vec.gz
gunzip cc.ko.300.vec.gz
python build_semantic.py ./cc.ko.300.vec --limit 300000

# ── 축2 문맥 ──────────────────────────────
curl -O https://dumps.wikimedia.org/kowiki/latest/kowiki-latest-pages-articles.xml.bz2
python -m wikiextractor.WikiExtractor kowiki-latest-pages-articles.xml.bz2 -o extracted --no-templates
python build_contextual.py ./extracted --window 5 --topk 200 --min-count 5

# ── 축3 관계 ──────────────────────────────
curl -O https://s3.amazonaws.com/conceptnet/downloads/2019/edges/conceptnet-assertions-5.7.0.csv.gz
python -c "import wn; wn.download('omw-ko:1.4')"
python build_relational.py --conceptnet ./conceptnet-assertions-5.7.0.csv.gz

# ── 확인 ─────────────────────────────────
python verify.py
```

## 가중치 튜닝
`supabase/migrations/0031_hidden_word_similarity_rpc.sql` 의 `w_sem/w_ctx/w_rel`,
`ppmi_cap`, 반의어 페널티 상수를 조정한 뒤 다시 `db push` 하면 즉시 반영된다(데이터 재적재 불필요).

## 라이선스 주의
fastText(CC-BY-SA 3.0), 위키(CC-BY-SA), ConceptNet(CC-BY-SA 4.0) 모두 **원본 재배포가 아닌
파생 수치(벡터/PPMI/관계)** 를 비공개 DB에 적재하는 용도다. 원본 덤프 파일은 저장소에 커밋하지 않는다.
