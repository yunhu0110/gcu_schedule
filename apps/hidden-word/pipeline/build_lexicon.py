"""
build_lexicon.py — Phase 2: 어휘집 (words / word_senses / word_categories) (지시서 §2·§2-2)

입력(모두 Phase 1/3/5 산출):
  noun_freq.tsv        명사 빈도(total/written/spoken)
  senses_merged.jsonl  다층위 WSD 의미(lemma·sense_id·pos·count) → 다의어 의미 분리(§2)
  relations.jsonl      NIKLex 간선 → hypernym IS-A 조상으로 카테고리 추론
  embeddings/w2v.kv    의미 벡터 → 카테고리 중심 코사인으로 보강

카테고리(§2-2, 20종): 자연/식물/동물/음식/신체/감정/행동/사람/사회/문화/경제/정치/
                      과학/기술/도구/사물/장소/건축/시간/공간. 복수 허용, 없으면 기타.

산출(data/processed/lexicon/, DB 적재는 Phase 6):
  words.jsonl          {"word","freq","freq_written","freq_spoken","usable","categories":[...]}
  word_senses.jsonl    {"word","sense_id","pos","count"}
  word_categories.jsonl{"word","category","via":"hypernym|embedding|seed"}

usable(봉투 후보 = 히든워드 적격): 2~6자 + 빈도대 [MIN_USABLE, 매우고빈도 제외] + 카테고리 보유.
  (히든워드는 '기타'만 가진 모호어/초고빈도 기능명사는 제외. 힌트 비교용 어휘는 전체 유지.)

실행(임베딩 학습 후): .venv/bin/python build_lexicon.py --min-freq 10
"""
from __future__ import annotations
import argparse, json, os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(ROOT, "data", "processed")
OUT = os.path.join(PROC, "lexicon")
KV = os.path.join(ROOT, "data", "embeddings", "w2v.kv")

# 20 카테고리: 임베딩 중심용 seed + hypernym 1홉 매칭용 root 단어
# root 는 '그 범주를 분명히 규정하는' 상위어만(generic 노드 행위/곳/부분/물체 제외 — 동형어 오염 방지).
# 커버리지는 임베딩 top-1 폴백이 보완한다(1홉 정밀 + 임베딩 재현).
CATEGORIES: dict[str, dict] = {
    "자연": {"seed": ["산", "강", "바다", "하늘", "구름", "바람", "비", "눈", "별", "돌", "불", "물", "호수"],
             "root": ["자연", "자연물", "천체", "별"]},
    "식물": {"seed": ["나무", "꽃", "풀", "잎", "뿌리", "씨앗", "소나무", "장미", "대나무", "열매"],
             "root": ["식물", "나무", "꽃", "풀", "채소류", "나물"]},
    "동물": {"seed": ["개", "고양이", "호랑이", "사자", "새", "물고기", "곰", "토끼", "말", "코끼리", "벌레"],
             "root": ["동물", "짐승", "포유동물", "포유류", "조류", "어류", "양서류", "파충류", "곤충", "절지동물", "새"]},
    "음식": {"seed": ["밥", "빵", "국", "김치", "고기", "과일", "채소", "라면", "떡", "반찬", "술"],
             "root": ["음식", "식품", "요리", "과일", "채소", "음료", "술", "과자", "빵", "떡", "고기"]},
    "신체": {"seed": ["손", "발", "머리", "코", "입", "귀", "팔", "다리", "심장", "피", "얼굴", "뼈"],
             "root": ["신체", "몸", "신체부위", "장기", "뼈", "근육", "살"]},
    "감정": {"seed": ["사랑", "기쁨", "슬픔", "분노", "행복", "두려움", "불안", "희망", "외로움", "질투"],
             "root": ["감정", "느낌", "정서", "심리"]},
    "행동": {"seed": ["달리기", "싸움", "공부", "노래", "춤", "놀이", "운동", "여행", "산책", "요리"],
             "root": ["운동", "경기", "놀이", "춤", "노래"]},
    "사람": {"seed": ["사람", "아이", "어른", "남자", "여자", "친구", "가족", "선생님", "학생", "의사", "아기"],
             "root": ["사람", "인간", "직업인", "전문가", "환자"]},
    "사회": {"seed": ["사회", "나라", "국가", "법", "제도", "단체", "조직", "공동체", "계급"],
             "root": ["사회", "집단", "단체", "조직", "제도", "계급", "민족"]},
    "문화": {"seed": ["문화", "예술", "음악", "영화", "책", "축제", "전통", "종교", "그림", "연극"],
             "root": ["문화", "예술", "음악", "미술", "문학", "종교", "영화", "작품"]},
    "경제": {"seed": ["돈", "경제", "시장", "기업", "은행", "주식", "가격", "소득", "무역", "세금"],
             "root": ["경제", "화폐", "금융", "상품", "세금"]},
    "정치": {"seed": ["정치", "정부", "대통령", "선거", "정당", "국회", "외교", "권력", "법률"],
             "root": ["정치", "정부", "권력기관", "법률"]},
    "과학": {"seed": ["과학", "물리", "화학", "생물", "실험", "이론", "우주", "원자", "세포", "에너지"],
             "root": ["과학", "학문", "원소", "화합물", "수학", "질병"]},
    "기술": {"seed": ["기술", "컴퓨터", "인터넷", "로봇", "스마트폰", "프로그램", "전자", "통신", "기계"],
             "root": ["기계", "장치", "기구", "전자기기", "탈것", "차량"]},
    "도구": {"seed": ["도구", "망치", "칼", "가위", "삽", "못", "펜", "열쇠", "바늘", "자"],
             "root": ["도구", "연장", "공구", "무기", "가구", "그릇", "용기", "옷"]},
    "사물": {"seed": ["물건", "사물", "공", "상자", "종이", "가방", "그릇", "병", "옷", "책상"],
             "root": ["물건", "물체", "재료", "물질"]},
    "장소": {"seed": ["장소", "학교", "병원", "공원", "시장", "도시", "마을", "길", "역", "식당"],
             "root": ["장소", "지역", "시설", "나라", "길"]},
    "건축": {"seed": ["건물", "집", "다리", "탑", "벽", "문", "창문", "아파트", "성", "지붕"],
             "root": ["건축물", "구조물", "집", "건물"]},
    "시간": {"seed": ["시간", "하루", "아침", "저녁", "밤", "계절", "봄", "여름", "가을", "겨울", "달"],
             "root": ["시간", "시기", "계절", "시대", "날"]},
    "공간": {"seed": ["공간", "방향", "거리", "면적", "지역", "위치", "표면", "구역", "경계"],
             "root": []},  # 추상 범주 — 임베딩 전용
}
MISC = "기타"


def load_noun_freq() -> dict[str, tuple[int, int, int]]:
    out = {}
    with open(os.path.join(PROC, "noun_freq.tsv"), encoding="utf-8") as f:
        for line in f:
            w, t, wr, sp = line.rstrip("\n").split("\t")
            out[w] = (int(t), int(wr), int(sp))
    return out


def load_hypernym(min_strength: float) -> dict[str, list[str]]:
    """child → [parent...] (IS-A). 카테고리 조상 탐색용.
    strength(주석자 합의도)가 하한 미만인 간선은 노이즈(예: 강아지 IS-A 사람 0.33)로 보고 제외."""
    parents = defaultdict(list)
    kept = dropped = 0
    with open(os.path.join(PROC, "relations.jsonl"), encoding="utf-8") as f:
        for line in f:
            r = json.loads(line)
            if r["rel"] == "hypernym" and r["dir"] == "a_isa_b":
                if r["strength"] >= min_strength:
                    parents[r["a"]].append(r["b"]); kept += 1
                else:
                    dropped += 1
    print(f"hypernym 간선: 채택 {kept:,} · strength<{min_strength} 제외 {dropped:,}")
    return parents


def hypernym_categories(word: str, parents: dict, root2cat: dict, max_hops=1) -> set[str]:
    """word 의 IS-A 조상 중 카테고리 root 와 일치하는 카테고리."""
    found, seen, frontier, hops = set(), {word}, [word], 0
    while frontier and hops < max_hops:
        nxt = []
        for w in frontier:
            for p in parents.get(w, []):
                if p in root2cat:
                    found.add(root2cat[p])
                if p not in seen:
                    seen.add(p); nxt.append(p)
        frontier = nxt; hops += 1
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-freq", type=int, default=10, help="어휘집 포함 최소 빈도")
    ap.add_argument("--emb-fallback", type=float, default=0.33,
                    help="seed/hypernym 미매칭 시 임베딩 top-1 채택 하한")
    ap.add_argument("--emb-strong", type=float, default=0.50,
                    help="임베딩 폴백에서 2순위 범주까지 채택하는 강한 하한")
    ap.add_argument("--emb-margin", type=float, default=0.06,
                    help="2순위가 1순위에 이 차이 이내로 근접할 때만 공동범주로 채택")
    ap.add_argument("--max-cats", type=int, default=2)
    ap.add_argument("--hyper-min-strength", type=float, default=0.6,
                    help="hypernym 카테고리 매칭 최소 strength(합의도). 미만은 노이즈로 제외")
    ap.add_argument("--usable-min", type=int, default=30)
    ap.add_argument("--usable-max-rank", type=int, default=150,
                    help="상위 N 초고빈도 명사는 히든워드 부적격(기능성)")
    args = ap.parse_args()
    os.makedirs(OUT, exist_ok=True)

    freq = load_noun_freq()
    vocab = {w: v for w, v in freq.items() if v[0] >= args.min_freq}
    print(f"어휘(freq>={args.min_freq}): {len(vocab):,}")

    parents = load_hypernym(args.hyper_min_strength)
    root2cat = {}
    for cat, spec in CATEGORIES.items():
        for r in spec["root"]:
            root2cat.setdefault(r, cat)

    # 임베딩 중심
    centroids = {}
    kv = None
    if os.path.exists(KV):
        from gensim.models import KeyedVectors
        import numpy as np
        kv = KeyedVectors.load(KV, mmap="r")
        for cat, spec in CATEGORIES.items():
            vs = [kv[s] for s in spec["seed"] if s in kv]
            if vs:
                c = np.mean(vs, axis=0)
                centroids[cat] = c / (np.linalg.norm(c) + 1e-9)
        print(f"임베딩 중심 {len(centroids)}개 (w2v.kv 로드)")
    else:
        print("⚠ w2v.kv 없음 — hypernym 만으로 카테고리 할당(임베딩 보강 생략)")

    seed_of = {}
    for cat, spec in CATEGORIES.items():
        for s in spec["seed"]:
            seed_of.setdefault(s, cat)

    # 할당 우선순위(§2-2): seed(프로토타입) > hypernym 1홉(정밀 상위어) > embedding 폴백.
    #   seed/hypernym 이 하나라도 잡으면 그것이 정답 — 임베딩 노이즈(top-3 오염)를 섞지 않는다.
    #   아무것도 못 잡은 단어만 임베딩 top-1(≥fallback), 충분히 강하면 top-2(≥strong)까지.
    words_out, cats_out = [], []
    import numpy as np
    emb_n = 0
    for w, (tot, wr, sp) in vocab.items():
        cats: dict[str, str] = {}
        if w in seed_of:
            cats[seed_of[w]] = "seed"
        for c in hypernym_categories(w, parents, root2cat, max_hops=1):
            cats.setdefault(c, "hypernym")
        if not cats and kv is not None and w in kv:
            v = kv[w]; v = v / (np.linalg.norm(v) + 1e-9)
            sims = sorted(((float(np.dot(v, c)), cat) for cat, c in centroids.items()),
                          reverse=True)
            if sims and sims[0][0] >= args.emb_fallback:
                cats[sims[0][1]] = "embedding"
                # 2순위는 '강하고(≥strong) 1순위에 근접(margin 이내)'할 때만 = 진짜 공동범주.
                #   (절대값만 보면 강아지→사람, 손가락→도구 같은 느슨한 꼬리가 붙음)
                if (len(sims) > 1 and sims[1][0] >= args.emb_strong
                        and sims[0][0] - sims[1][0] <= args.emb_margin):
                    cats.setdefault(sims[1][1], "embedding")
                emb_n += 1
        # 상위 max_cats 로 제한(seed/hypernym 우선)
        order = {"seed": 0, "hypernym": 1, "embedding": 2}
        chosen = sorted(cats.items(), key=lambda kv2: order[kv2[1]])[:args.max_cats]
        catlist = [c for c, _ in chosen] or [MISC]
        words_out.append({"word": w, "freq": tot, "freq_written": wr, "freq_spoken": sp,
                          "categories": catlist})
        for c, via in chosen:
            cats_out.append({"word": w, "category": c, "via": via})

    # usable 판정: 길이 2~6 + 빈도대 + 비기타
    ranked = sorted(vocab.items(), key=lambda x: x[1][0], reverse=True)
    too_common = {w for w, _ in ranked[:args.usable_max_rank]}
    for rec in words_out:
        w = rec["word"]
        rec["usable"] = (
            2 <= len(w) <= 6
            and rec["freq"] >= args.usable_min
            and w not in too_common
            and rec["categories"] != [MISC]
        )

    with open(os.path.join(OUT, "words.jsonl"), "w", encoding="utf-8") as f:
        for r in words_out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    with open(os.path.join(OUT, "word_categories.jsonl"), "w", encoding="utf-8") as f:
        for r in cats_out:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    # word_senses: 어휘집에 있는 표제어만
    nsense = 0
    with open(os.path.join(PROC, "senses_merged.jsonl"), encoding="utf-8") as fi, \
         open(os.path.join(OUT, "word_senses.jsonl"), "w", encoding="utf-8") as fo:
        for line in fi:
            r = json.loads(line)
            if r["lemma"] in vocab:
                fo.write(json.dumps({"word": r["lemma"], "sense_id": r["sense_id"],
                                     "pos": r["pos"], "count": r["count"]},
                                    ensure_ascii=False) + "\n")
                nsense += 1

    usable = sum(1 for r in words_out if r["usable"])
    misc_only = sum(1 for r in words_out if r["categories"] == [MISC])
    from collections import Counter
    cat_dist = Counter(c for r in words_out for c in r["categories"])
    via_dist = Counter(r["via"] for r in cats_out)
    print(f"words {len(words_out):,} · usable {usable:,} · 기타만 {misc_only:,} · senses {nsense:,}")
    print(f"임베딩 폴백 적용 단어 {emb_n:,}")
    print("할당 경로:", dict(via_dist))
    print("카테고리 분포:", dict(cat_dist.most_common()))


if __name__ == "__main__":
    main()
