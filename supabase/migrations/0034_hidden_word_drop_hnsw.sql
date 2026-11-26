-- 0034 · 의미축 HNSW 인덱스 제거 — 무료 티어 스토리지 절감
-- hw_similarity RPC 는 단어로 pkey(btree) 조회해 두 벡터의 쌍거리(va <=> vb)만 계산한다.
-- 최근접 이웃(ANN) 탐색을 전혀 하지 않으므로 HNSW 인덱스는 사용되지 않는 사표(dead weight)다.
-- halfvec HNSW 인덱스는 테이블 heap 과 맞먹는 용량을 차지하므로, 제거하면 같은 무료 한도(500MB)
-- 안에서 약 2배 더 많은 추측 어휘 벡터를 적재할 수 있다.
-- 추후 '가까운 단어 힌트' 같은 ANN 기능이 필요해지면 그때 인덱스를 다시 만든다.
drop index if exists public.hw_word_vectors_vec_idx;
