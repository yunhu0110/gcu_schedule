"""DB 없이 NIKL XML 파싱 검증 — 관계/어휘 추출이 맞는지 눈으로 확인."""
import sys, xml.etree.ElementTree as ET
from collections import Counter
from build_relational import nikl_surface, URIMAL_TYPE
from common import normalize

path = sys.argv[1]
rel_counts = Counter()
rel_samples = []
noun_all = set(); noun_general = set()
n_items = 0

for _, item in ET.iterparse(path, events=("end",)):
    if item.tag != "item":
        continue
    n_items += 1
    wi = item.find("wordInfo")
    head = nikl_surface(wi.findtext("word", "") if wi is not None else "")
    if head:
        is_noun = False
        for si in item.findall("senseInfo"):
            if "명사" in (si.findtext("pos", "") or ""):
                is_noun = True
            stype = (si.findtext("type", "") or "").strip()
            for ri in si.findall("relation_info"):
                raw = ri.findtext("word", "")
                rel = URIMAL_TYPE.get((ri.findtext("type", "") or "").strip())
                surf = nikl_surface(raw)
                if rel and surf:
                    rel_counts[rel] += 1
                    if len(rel_samples) < 12:
                        rel_samples.append((rel, head, raw, surf))
            if is_noun:
                noun_all.add(normalize(head))
                if stype == "일반어":
                    noun_general.add(normalize(head))
    item.clear()

print(f"총 item: {n_items:,}")
print(f"\n우리가 쓰는 4종 관계 추출(표면형 기준):")
for r in ("synonym","antonym","hypernym","hyponym"):
    print(f"  {r}: {rel_counts[r]:,}")
print(f"  합계: {sum(rel_counts.values()):,}")
print(f"\n명사 어휘(표제어, 중복 제거):")
print(f"  전체 명사: {len(noun_all):,}")
print(f"  일반어 명사만: {len(noun_general):,}")
print(f"\n원본 → 표면형 변환 샘플(표제어 / 관계어):")
for rel, head, raw, surf in rel_samples:
    print(f"  [{rel:9}] {head:12} ← {raw!r:22} → {surf!r}")
