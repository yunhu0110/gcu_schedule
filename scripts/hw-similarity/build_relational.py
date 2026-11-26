"""
축3 · 어휘 관계 적재 (ConceptNet 5 + Open Korean WordNet → public.hw_word_relations)

유의어(synonym)/반의어(antonym)/상위어(hypernym)/하위어(hyponym) 만 다룬다.
핵심 최적화: 풀 단어가 한쪽에 있는 관계만, 풀 단어를 word 측에 앵커링해 저장한다.

입력 A — 우리말샘 opendict (CC BY-SA 2.0 KR) ⭐ 한국어 관계 최강:
  https://opendict.korean.go.kr → '사전 내려받기' → XML. 비슷한말/반대말/상위어/하위어 포함.
입력 B — ConceptNet 5 assertions (CC-BY-SA 4.0):
  https://s3.amazonaws.com/conceptnet/downloads/2019/edges/conceptnet-assertions-5.7.0.csv.gz
입력 C — Open Multilingual Wordnet 한국어(wn 패키지, 자동 다운로드):
  wn.download('omw-ko:1.4')

실행:
  export SUPABASE_DB_URL=...
  python build_relational.py --urimalsaem ./urimalsaem/*.xml --conceptnet ./conceptnet-assertions-5.7.0.csv.gz
  (각 소스는 선택. --no-wordnet 로 WordNet 생략 가능)
"""
from __future__ import annotations
import argparse, gzip, json, re
import xml.etree.ElementTree as ET
from tqdm import tqdm
from common import db, pool_words, normalize

# (word=pool측, related, relation, weight) 누적
Rows = dict  # key=(word, related, relation) -> weight(max)

# 관계의 역방향(하위어 앵커링 보정용)
INVERSE = {"synonym": "synonym", "antonym": "antonym",
           "hypernym": "hyponym", "hyponym": "hypernym"}


def ko_word(uri: str) -> str | None:
    # '/c/ko/나무' 또는 '/c/ko/나무/n' → '나무'
    parts = uri.split("/")
    if len(parts) >= 4 and parts[1] == "c" and parts[2] == "ko":
        return normalize(parts[3].replace("_", " "))
    return None


def add(rows: Rows, word: str, related: str, relation: str, weight: float):
    if not word or not related or word == related:
        return
    w = max(0.0, min(1.0, weight))
    key = (word, related, relation)
    if w > rows.get(key, -1):
        rows[key] = w


def add_fact(rows: Rows, pool: set[str], h: str, w: str, relation: str, weight: float):
    """'h 의 relation 이 w' 라는 사실을 pool 앵커(word∈pool)로 양방향 저장."""
    h, w = normalize(h), normalize(w)
    if not h or not w or h == w:
        return
    if h in pool:
        add(rows, h, w, relation, weight)
    if w in pool:
        add(rows, w, h, INVERSE[relation], weight)


# 우리말샘/기초사전 관계 유형 → 내부 관계 (이 4종만 사용)
URIMAL_TYPE = {
    "비슷한말": "synonym", "유의어": "synonym",
    "반대말": "antonym", "반의어": "antonym",
    "상위어": "hypernym", "하위어": "hyponym",
}

# NIKL 표제어/관계어에 섞인 분석 기호(붙임표·붙여쓰기 허용·가운뎃점)와 말번호(동형어 번호)
_NIKL_NUM = re.compile(r"\d+$")
_NIKL_MARK = str.maketrans("", "", "-^·ㆍ~")


def nikl_surface(w: str) -> str:
    """'자음-자001' → '자음자', '가내^노비001' → '가내노비' 처럼 표면형으로 정리."""
    if not w:
        return ""
    w = _NIKL_NUM.sub("", w.strip())      # 뒤쪽 동형어 번호 제거
    return w.translate(_NIKL_MARK)         # 분석 기호 제거


def from_urimalsaem(paths: list[str], pool: set[str], rows: Rows,
                    vocab: set[str] | None = None, vocab_general_only: bool = False):
    """실제 NIKL XML 스키마:
      <item>
        <wordInfo><word>표제어</word></wordInfo>
        <senseInfo>
          <pos>명사</pos> <type>일반어|옛말|북한어|방언</type>
          <relation_info><word>관계어</word><type>상위어|비슷한말|...</type></relation_info>
        </senseInfo>
      </item>
    item 단위로 iterparse → 처리 후 clear (대용량 스트리밍).
    """
    for path in paths:
        print(f"우리말샘 파싱… {path}")
        for _, item in ET.iterparse(path, events=("end",)):
            if item.tag != "item":
                continue
            wi = item.find("wordInfo")
            head = nikl_surface(wi.findtext("word", "") if wi is not None else "")
            if head:
                is_noun = False
                for si in item.findall("senseInfo"):
                    if "명사" in (si.findtext("pos", "") or ""):
                        is_noun = True
                    stype = (si.findtext("type", "") or "").strip()
                    for ri in si.findall("relation_info"):
                        rel = URIMAL_TYPE.get((ri.findtext("type", "") or "").strip())
                        rword = nikl_surface(ri.findtext("word", ""))
                        if rel and rword:
                            add_fact(rows, pool, head, rword, rel, 1.0)
                    # 어휘 수집(명사 한정, 옵션에 따라 일반어만)
                    if vocab is not None and is_noun and (not vocab_general_only or stype == "일반어"):
                        nw = normalize(head)
                        if nw:
                            vocab.add(nw)
            item.clear()


def from_conceptnet(path: str, pool: set[str], rows: Rows):
    print(f"ConceptNet 스캔… {path}")
    op = gzip.open if path.endswith(".gz") else open
    with op(path, "rt", encoding="utf-8", errors="ignore") as f:
        for line in tqdm(f):
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 5:
                continue
            rel, start, end, meta = cols[1], cols[2], cols[3], cols[4]
            a, b = ko_word(start), ko_word(end)
            if not a or not b:
                continue
            if a not in pool and b not in pool:
                continue
            try:
                weight = min(1.0, float(json.loads(meta).get("weight", 1.0)) / 2.0)
            except Exception:
                weight = 0.5

            if rel == "/r/Synonym" or rel == "/r/SimilarTo":
                if a in pool: add(rows, a, b, "synonym", weight)
                if b in pool: add(rows, b, a, "synonym", weight)
            elif rel == "/r/Antonym":
                if a in pool: add(rows, a, b, "antonym", weight)
                if b in pool: add(rows, b, a, "antonym", weight)
            elif rel == "/r/IsA":
                # a IsA b : b는 a의 상위어
                if a in pool: add(rows, a, b, "hypernym", weight)
                if b in pool: add(rows, b, a, "hyponym", weight)


def from_wordnet(pool: set[str], rows: Rows):
    try:
        import wn
    except Exception:
        print("⚠ wn 패키지 없음 → WordNet 생략"); return
    try:
        net = wn.Wordnet("omw-ko:1.4")
    except Exception:
        print("⚠ omw-ko 데이터 없음. 먼저 `python -c \"import wn; wn.download('omw-ko:1.4')\"` 실행. WordNet 생략.")
        return
    print("WordNet(omw-ko) 관계 추출…")

    def lemmas(ss):
        out = []
        for w in ss.words():
            for form in w.forms():
                nf = normalize(form)
                if nf:
                    out.append(nf)
        return out

    for pw in tqdm(sorted(pool)):
        for ss in net.synsets(pw):
            for lm in lemmas(ss):
                add(rows, pw, lm, "synonym", 0.9)
            for hyper in ss.hypernyms():
                for lm in lemmas(hyper):
                    add(rows, pw, lm, "hypernym", 0.8)
            for hypo in ss.hyponyms():
                for lm in lemmas(hypo):
                    add(rows, pw, lm, "hyponym", 0.8)
        # 반의어(sense 관계)
        try:
            for w in net.words(pw):
                for sense in w.senses():
                    for ant in sense.get_related("antonym"):
                        for form in ant.word().forms():
                            add(rows, pw, normalize(form), "antonym", 0.9)
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--urimalsaem", nargs="*", default=[], help="우리말샘 XML 파일들")
    ap.add_argument("--conceptnet", help="conceptnet-assertions-*.csv(.gz) 경로")
    ap.add_argument("--no-wordnet", action="store_true")
    ap.add_argument("--dump-vocab", help="우리말샘 명사 표제어를 이 파일로 덤프(KR-SBERT 어휘로 사용)")
    ap.add_argument("--vocab-general-only", action="store_true",
                    help="어휘 덤프 시 type=일반어 명사만 수집(옛말/북한어/방언/전문어 제외)")
    args = ap.parse_args()

    conn = db()
    pool = set(pool_words(conn))
    rows: Rows = {}
    vocab: set[str] = set() if args.dump_vocab else None

    if args.urimalsaem:
        from_urimalsaem(args.urimalsaem, pool, rows, vocab, args.vocab_general_only)
    if args.dump_vocab and vocab is not None:
        with open(args.dump_vocab, "w", encoding="utf-8") as f:
            f.write("\n".join(sorted(vocab)))
        print(f"어휘 {len(vocab)}개 → {args.dump_vocab}")
    if args.conceptnet:
        from_conceptnet(args.conceptnet, pool, rows)
    if not args.no_wordnet:
        from_wordnet(pool, rows)

    payload = [(w, r, rel, wt) for (w, r, rel), wt in rows.items()]
    print(f"{len(payload)}개 관계 → hw_word_relations upsert")
    with conn.cursor() as cur:
        cur.executemany(
            "insert into public.hw_word_relations(word, related, relation, weight) values (%s,%s,%s,%s) "
            "on conflict (word, related, relation) do update set weight = greatest(hw_word_relations.weight, excluded.weight)",
            payload,
        )
        conn.commit()
    conn.close()
    print("완료.")


if __name__ == "__main__":
    main()
