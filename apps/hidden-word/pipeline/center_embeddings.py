"""
center_embeddings.py — Phase 3 후처리: 임베딩 비등방성 제거(평균벡터 차감)

관찰: 학습된 word2vec 임베딩은 전역 평균벡터 노름이 0.489 로 매우 커(등방적이면 ~0),
      모든 벡터가 한 방향으로 쏠려 랜덤쌍 코사인 중앙값이 0.226 까지 부풀려졌다.
      → 의미축이 무관한 단어쌍도 높게 평가(과포화), ≥95 게이트가 헐거워짐.

처리(표준 'mean subtraction' 등방화):
  v̂ = normalize(v);  v' = normalize(v̂ − mean(v̂))
  효과: 랜덤쌍 코사인 중앙값 0.226 → ≈0, 관련쌍은 높게 유지 → 변별력 회복.

입력:  data/embeddings/nouns.vec.jsonl   ({"w","v"} 200-d)
출력:  data/embeddings/nouns.centered.vec.jsonl  (동일 포맷, 소수 4자리)
       data/embeddings/mean_vector.json           (참조용 평균벡터·진단)
DB 적재: load_to_supabase.py --only embeddings --truncate 가 centered 파일을 우선 사용.
"""
from __future__ import annotations
import json, os
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMB = os.path.join(ROOT, "data", "embeddings")
SRC = os.path.join(EMB, "nouns.vec.jsonl")
OUT = os.path.join(EMB, "nouns.centered.vec.jsonl")
DIAG = os.path.join(EMB, "mean_vector.json")


def main():
    words, vecs = [], []
    for line in open(SRC, encoding="utf-8"):
        o = json.loads(line)
        words.append(o["w"] if "w" in o else o["word"])
        vecs.append(o["v"] if "v" in o else o["vec"])
    V = np.asarray(vecs, dtype=np.float32)
    n, d = V.shape
    Vn = V / (np.linalg.norm(V, axis=1, keepdims=True) + 1e-9)
    mean = Vn.mean(axis=0)
    mnorm = float(np.linalg.norm(mean))
    Vc = Vn - mean
    Vc = Vc / (np.linalg.norm(Vc, axis=1, keepdims=True) + 1e-9)

    with open(OUT, "w", encoding="utf-8") as f:
        for w, v in zip(words, Vc):
            f.write(json.dumps({"w": w, "v": [round(float(x), 4) for x in v]}, ensure_ascii=False) + "\n")
    json.dump({"dim": d, "count": n, "mean_norm": mnorm, "mean": [round(float(x), 6) for x in mean]},
              open(DIAG, "w", encoding="utf-8"))
    print(f"임베딩 {n:,}×{d} · 전역 평균노름 {mnorm:.3f} → 평균차감·재정규화 완료 → {OUT}")


if __name__ == "__main__":
    main()
