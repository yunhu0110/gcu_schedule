"""
NIKL(우리말샘) XML 오프라인 전처리 — DB 불필요. (스토리지 절감형)
  vocab.txt      : 명사 표제어 중 '일반어+전문어' 만(옛말/방언/북한어 제외),
                   순 한글 1~12자만(초장문·자모·숫자 섞인 항목 제외). KR-SBERT 어휘.
  relations.tsv  : 관계 전체 (head<TAB>related<TAB>relation), 표면형·중복제거.
실행:  .venv/bin/python preprocess.py data/opendict
"""
import argparse, glob, os, re, sys
import xml.etree.ElementTree as ET
from collections import Counter
from build_relational import nikl_surface, URIMAL_TYPE
from common import normalize

ap = argparse.ArgumentParser()
ap.add_argument("src")
ap.add_argument("--vocab", default="vocab.txt")
ap.add_argument("--relations", default="relations.tsv")
ap.add_argument("--allow", default="일반어,전문어", help="어휘로 포함할 sense type(쉼표)")
ap.add_argument("--maxlen", type=int, default=12)
args = ap.parse_args()

allow = set(args.allow.split(","))
HANGUL = re.compile(rf"[가-힣]{{1,{args.maxlen}}}$")

paths = sorted(glob.glob(os.path.join(args.src, "*.xml")) if os.path.isdir(args.src) else glob.glob(args.src))
if not paths:
    sys.exit(f"XML 없음: {args.src}")

# 명사 표제어별로 등장한 sense type 집합
noun_types = {}       # word -> set(types)
rels = set()
rel_counts = Counter()
n_items = 0

for path in paths:
    print(f"파싱… {os.path.basename(path)}", flush=True)
    for _, item in ET.iterparse(path, events=("end",)):
        if item.tag != "item":
            continue
        n_items += 1
        wi = item.find("wordInfo")
        head = nikl_surface(wi.findtext("word", "") if wi is not None else "")
        hn = normalize(head)
        if hn:
            for si in item.findall("senseInfo"):
                stype = (si.findtext("type", "") or "").strip()
                if "명사" in (si.findtext("pos", "") or ""):
                    noun_types.setdefault(hn, set()).add(stype)
                for ri in si.findall("relation_info"):
                    rel = URIMAL_TYPE.get((ri.findtext("type", "") or "").strip())
                    rw = normalize(nikl_surface(ri.findtext("word", "")))
                    if rel and rw and rw != hn and (hn, rw, rel) not in rels:
                        rels.add((hn, rw, rel)); rel_counts[rel] += 1
        item.clear()

# 버킷 집계 + 어휘 선정
b_gen = b_tech = b_other = 0
vocab = set()
for w, types in noun_types.items():
    if "일반어" in types: b_gen += 1
    elif "전문어" in types: b_tech += 1
    else: b_other += 1
    if (types & allow) and HANGUL.match(w):
        vocab.add(w)

with open(args.vocab, "w", encoding="utf-8") as f:
    f.write("\n".join(sorted(vocab)))
with open(args.relations, "w", encoding="utf-8") as f:
    for h, r, rel in sorted(rels):
        f.write(f"{h}\t{r}\t{rel}\n")

print(f"\n총 item: {n_items:,}")
print(f"고유 명사 표제어: {len(noun_types):,}")
print(f"  일반어 보유: {b_gen:,} / 전문어만: {b_tech:,} / 기타(옛말·방언·북한어)만: {b_other:,}")
print(f"→ 어휘 채택(allow={sorted(allow)}, 한글 1~{args.maxlen}자): {len(vocab):,}  → {args.vocab}")
print(f"관계(중복제거): {sum(rel_counts.values()):,}  분포={dict(rel_counts)}  → {args.relations}")
vec_mb = len(vocab)*768*4/1e6; half_mb = len(vocab)*768*2/1e6
print(f"\n저장 추정(인덱스 제외): vector(768)≈{vec_mb:,.0f}MB, halfvec(768)≈{half_mb:,.0f}MB")
