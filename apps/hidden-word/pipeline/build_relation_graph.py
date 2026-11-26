"""
build_relation_graph.py — Phase 5: 관계 그래프 (NIKLex → word_relations 간선)

NIKLex 어휘관계자료 4종을 정규화된 유향/무향 간선으로 변환한다. (지시서 §5-4 관계축 토대)
  · synonym(비슷한말) : 무향, canonical 정렬(a<b)
  · antonym (반대말)  : 무향, canonical 정렬(a<b) — Phase 7에서 강한 감점 신호
  · hypernym(상·하위어): child→parent 단일 유향으로 통합
       상위어 파일 word1 IS-A word2  (예: 사과→과일)  → a=word1, b=word2
       하위어 파일 word2 IS-A word1  (예: 과일→감귤) → a=word2, b=word1

표면형: word1/word2 는 이미 표제어(의미접미 없음). 합성 기호(ㆍ·^-·공백) 제거 후
       한글 음절 1~16자만 채택(ㄱㄴㄷ순 등 자모·기호 표제어는 게임과 무관 → 제외).
의미ID: word1(sense)/word2(sense) 끝 3자리를 보존(Phase 7 선택적 의미구분용).
강도   : NIKLex mean(1~5 동의도) → strength=(mean-1)/4 ∈[0,1]. sd 도 보존(불확실 간선 식별).

산출(apps/hidden-word/data/processed/relations.jsonl, DB 미적재·gitignore):
  {"a","b","rel","dir","strength","mean","sd","pos","sa","sb"}
  (DB 적재는 Phase 6, 3홉 경로점수는 Phase 7)

실행: .venv/bin/python build_relation_graph.py
"""
from __future__ import annotations
import csv, json, os, re
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # apps/hidden-word
NIKLEX = os.path.join(ROOT, "korean", "NIKLex어휘관계자료")
OUT = os.path.join(ROOT, "data", "processed", "relations.jsonl")
REPORT = os.path.join(ROOT, "data", "processed", "relations_report.json")

SYLL = re.compile(r"^[가-힣]{1,16}$")
_SYM = re.compile(r"[ㆍ·^\-\s]")
_SENSE = re.compile(r"(\d{1,3})$")

FILES = {
    "synonym":  ("NIKLex_synonym.tsv",  "sym"),
    "antonym":  ("NIKLex_antonym.tsv",  "sym"),
    "hypernym": ("NIKLex_hypernym.tsv", "hyper_w1_isa_w2"),  # word1 IS-A word2
    "hyponym":  ("NIKLex_hyponym.tsv",  "hypo_w2_isa_w1"),   # word2 IS-A word1
}


def surface(w: str) -> str | None:
    s = _SYM.sub("", (w or "").strip())
    return s if SYLL.match(s) else None


def sense_of(tagged: str, bare: str) -> str | None:
    """word1(sense) 끝 숫자 → 의미ID. bare 로 끝나는 경우에 한해."""
    m = _SENSE.search(tagged or "")
    return m.group(1).zfill(3) if m else None


def main():
    seen: set[tuple] = set()
    counts = Counter()
    kept = Counter()
    dropped = Counter()
    rows_out = []

    for rel, (fn, mode) in FILES.items():
        path = os.path.join(NIKLEX, fn)
        with open(path, encoding="utf-8") as f:
            for r in csv.DictReader(f, delimiter="\t"):
                counts[rel] += 1
                pos = r.get("POS", "")
                a0, b0 = surface(r["word1"]), surface(r["word2"])
                if not a0 or not b0 or a0 == b0:
                    dropped[rel] += 1
                    continue
                try:
                    mean = float(r["mean"]); sd = float(r.get("sd") or 0)
                except ValueError:
                    dropped[rel] += 1
                    continue
                sa = sense_of(r.get("word1(sense)", ""), r["word1"])
                sb = sense_of(r.get("word2(sense)", ""), r["word2"])

                # 방향 정규화
                if mode == "sym":
                    a, b = (a0, b0) if a0 < b0 else (b0, a0)
                    if a0 >= b0:
                        sa, sb = sb, sa
                    out_rel, out_dir = rel, "sym"
                elif mode == "hyper_w1_isa_w2":
                    a, b, sa, sb = a0, b0, sa, sb          # a IS-A b
                    out_rel, out_dir = "hypernym", "a_isa_b"
                else:  # hypo_w2_isa_w1 : word2 IS-A word1
                    a, b, sa, sb = b0, a0, sb, sa          # a(child=word2) IS-A b(parent=word1)
                    out_rel, out_dir = "hypernym", "a_isa_b"

                key = (out_rel, out_dir, a, b)
                if key in seen:
                    dropped[rel] += 1
                    continue
                seen.add(key)
                kept[out_rel] += 1
                rows_out.append({
                    "a": a, "b": b, "rel": out_rel, "dir": out_dir,
                    "strength": round((mean - 1) / 4, 4), "mean": mean, "sd": sd,
                    "pos": pos, "sa": sa, "sb": sb,
                })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        for row in rows_out:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    nodes = set()
    for row in rows_out:
        nodes.add(row["a"]); nodes.add(row["b"])
    report = {
        "source_rows": dict(counts),
        "kept_edges": dict(kept),
        "dropped": dict(dropped),
        "total_edges": len(rows_out),
        "unique_nodes": len(nodes),
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"간선 {len(rows_out):,} · 노드 {len(nodes):,} → {OUT}")
    for k in ("synonym", "antonym", "hypernym"):
        print(f"  {k:9} {kept[k]:>7,}")
    print(f"제외(비한글·중복·동일): {dict(dropped)}")


if __name__ == "__main__":
    main()
