"""
calibrate_similarity.py — Phase 7 캘리브레이션 (지시서 §5 MAD/z/sigmoid 계열)

각 축의 raw 지표를 '그 축의 실제 분포' 기준으로 로지스틱 [0,1] 정규화하기 위한 center/scale 을 적합한다.
  · 의미(semantic) : 랜덤쌍 코사인 중앙값(lo) ↔ 동의어쌍 코사인 중앙값(hi)
  · 문맥(contextual): 관측 NPMI 분포의 하위분위(lo) ↔ 상위분위(hi)
  · 관계(relation) : 샘플 관계쌍 경로점수의 하위분위(lo) ↔ 상위분위(hi)
center = (hi+lo)/2, scale = (hi-lo)/(2·logit(0.9))  ⇒  lo→0.1, hi→0.9 로 사상.
결과를 hw_sim_calibration 에 기록하고, 검증쌍·동의어/랜덤 합성점수 분포를 출력해 품질을 확인한다.

실행(cooc 적재 후): .venv/bin/python calibrate_similarity.py
"""
from __future__ import annotations
import math, os, statistics
import psycopg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV = os.path.join(os.path.dirname(os.path.dirname(ROOT)), "scripts", "hw-similarity", ".env.local")
LOGIT09 = math.log(0.9 / 0.1)  # ≈2.197


def url():
    u = os.environ.get("SUPABASE_DB_URL")
    if not u and os.path.exists(ENV):
        for line in open(ENV):
            if line.startswith("SUPABASE_DB_URL="):
                u = line.split("=", 1)[1].strip().strip('"').strip("'")
    return u


def center_scale(lo: float, hi: float) -> tuple[float, float]:
    if hi <= lo:
        hi = lo + 0.1
    return (hi + lo) / 2.0, max((hi - lo) / (2 * LOGIT09), 0.03)


def main():
    with psycopg.connect(url()) as c, c.cursor() as cur:
        cur.execute("set statement_timeout = 0")  # 오프라인 적합(관계축 샘플 호출이 길 수 있음)
        params = {}

        # ── 의미축 ──
        # 앵커: lo=랜덤쌍 코사인 p95(여기까지는 '무관'으로 억제), hi=동의어쌍 코사인 p80.
        #   동의어 '중앙값'은 희귀어 저품질 임베딩에 오염돼 과소추정(→scale 과소→포화) 되므로 쓰지 않는다.
        cur.execute("""
          with s as (select vec, row_number() over () rn
                     from (select vec from public.hw_word_embeddings order by random() limit 8000) x),
               t as (select vec, row_number() over () rn
                     from (select vec from public.hw_word_embeddings order by random() limit 8000) y)
          select percentile_cont(0.95) within group (order by greatest(0, 1-(s.vec <=> t.vec)))
          from s join t on s.rn = t.rn
        """)
        sem_lo = float(cur.fetchone()[0])
        cur.execute("""
          with syn as (select a, b from public.hw_word_relations where rel='synonym' order by random() limit 8000)
          select percentile_cont(0.80) within group (order by greatest(0, 1-(ea.vec <=> eb.vec)))
          from syn join public.hw_word_embeddings ea on ea.word=syn.a
                    join public.hw_word_embeddings eb on eb.word=syn.b
        """)
        sem_hi = float(cur.fetchone()[0] or (sem_lo + 0.4))
        params["semantic"] = center_scale(sem_lo, sem_hi)
        print(f"의미: 랜덤p95={sem_lo:.3f} 동의어p80={sem_hi:.3f} → center={params['semantic'][0]:.3f} scale={params['semantic'][1]:.3f}")

        # ── 문맥축(NPMI 분포) ──
        cur.execute("select count(*) from public.hw_word_cooc")
        n_cooc = cur.fetchone()[0]
        if n_cooc > 0:
            cur.execute("""select percentile_cont(0.30) within group (order by npmi),
                                  percentile_cont(0.92) within group (order by npmi)
                           from public.hw_word_cooc""")
            ctx_lo, ctx_hi = (float(x) for x in cur.fetchone())
            params["contextual"] = center_scale(ctx_lo, ctx_hi)
            print(f"문맥: NPMI p30={ctx_lo:.3f} p92={ctx_hi:.3f} ({n_cooc:,}쌍) → center={params['contextual'][0]:.3f} scale={params['contextual'][1]:.3f}")
        else:
            print("문맥: hw_word_cooc 비어있음 — 문맥축 캘리브레이션 생략(기본값 유지)")

        # ── 관계축(샘플 경로점수 분포) ──
        cur.execute("""
          with p as (select a, b from public.hw_word_relations order by random() limit 1500)
          select public.hw_axis_relation(a, b) r from p
        """)
        rels = sorted(float(r[0]) for r in cur.fetchall() if r[0] is not None)
        if len(rels) >= 20:
            rel_lo = rels[int(0.10 * len(rels))]   # p10: 약한 경로도 완전히 0으로 붕괴하지 않게 폭 확보
            rel_hi = rels[int(0.90 * len(rels))]
            params["relation"] = center_scale(rel_lo, rel_hi)
            print(f"관계: 경로 p25={rel_lo:.3f} p90={rel_hi:.3f} (n={len(rels)}) → center={params['relation'][0]:.3f} scale={params['relation'][1]:.3f}")
        else:
            print("관계: 샘플 부족 — 기본값 유지")

        for axis, (ce, sc) in params.items():
            cur.execute("""update public.hw_sim_calibration set center=%s, scale=%s, updated=now() where axis=%s""",
                        (ce, sc, axis))
        c.commit()
        print("hw_sim_calibration 갱신:", {k: (round(v[0], 3), round(v[1], 3)) for k, v in params.items()})

        # ── 검증 ──
        print("\n=== 검증쌍 합성점수 ===")
        for a, b in [("나무","소나무"),("나무","도토리"),("나무","숲"),("나무","질책"),
                     ("여름","겨울"),("개","고양이"),("사과","배"),("컴퓨터","노트북"),("사랑","연애")]:
            cur.execute("select score,semantic,contextual,relation from public.hw_word_similarity(%s,%s)", (a, b))
            row = cur.fetchone()
            if row:
                s, se, ct, re = row
                f = lambda x: f"{x:.2f}" if x is not None else "—"
                print(f"  {a}~{b}: {s}  (의미 {f(se)} 문맥 {f(ct)} 관계 {f(re)})")

        print("\n=== 분포(합성점수) ===")
        cur.execute("""
          with syn as (select a,b from public.hw_word_relations where rel='synonym' order by random() limit 400)
          select percentile_cont(0.5) within group (order by sc.score),
                 percentile_cont(0.9) within group (order by sc.score)
          from syn, lateral public.hw_word_similarity(syn.a, syn.b) sc
        """)
        syn_p50, syn_p90 = cur.fetchone()
        cur.execute("""
          with w as (select word from public.hw_words where usable order by random() limit 400),
               v as (select word, row_number() over () rn from w),
               u as (select word, row_number() over () rn from (select word from public.hw_words where usable order by random() limit 400) z)
          select percentile_cont(0.5) within group (order by sc.score),
                 percentile_cont(0.95) within group (order by sc.score)
          from v join u on v.rn=u.rn and v.word<>u.word,
               lateral public.hw_word_similarity(v.word, u.word) sc
        """)
        rnd_p50, rnd_p95 = cur.fetchone()
        print(f"  동의어쌍 점수: 중앙 {syn_p50:.1f} · p90 {syn_p90:.1f}")
        print(f"  랜덤쌍 점수:   중앙 {rnd_p50:.1f} · p95 {rnd_p95:.1f}")


if __name__ == "__main__":
    main()
