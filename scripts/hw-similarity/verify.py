"""
적재 후 눈으로 확인 — 샘플 쌍의 유사도를 hw_similarity()로 찍어본다.
  export SUPABASE_DB_URL=...
  python verify.py
"""
from common import db

SAMPLES = [
    ("나무", "소나무"),   # 하위어 → 높음
    ("나무", "버섯"),     # 문맥 공생 → 중간
    ("나무", "자동차"),   # 무관 → 낮음
    ("뜨겁다", "차갑다"), # 반의어 → 강하게 눌림(낮음)
    ("바다", "바다"),     # 동일 → 100
    ("행복", "기쁨"),     # 유의어 → 높음
]


def main():
    conn = db()
    with conn.cursor() as cur:
        print(f"{'정답':<8}{'추측':<8}{'점수':>8}")
        print("-" * 26)
        for a, b in SAMPLES:
            cur.execute("select public.hw_similarity(%s, %s)", (a, b))
            (score,) = cur.fetchone()
            print(f"{a:<8}{b:<8}{str(score):>8}")
    conn.close()


if __name__ == "__main__":
    main()
