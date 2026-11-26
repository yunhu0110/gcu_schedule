"""
aggregate_manifest.py — Phase 1 마무리: 데이터 사전 + 품질 리포트 + 명사 빈도

전처리 샤드(processed/corpus/**/*.jsonl)와 의미(senses/*.jsonl)를 집계한다.
산출:
  data/processed/noun_freq.tsv            word \t total \t written \t spoken  (Phase 2 어휘컷·Phase 4 앵커)
  data/processed/senses_merged.jsonl      {"lemma","sense_id","pos","count"} 병합(Phase 2 word_senses)
  data/manifests/data_manifest.json       소스·도메인·토큰/문장수·중복제외 기록(§1 데이터 사전)
  data/manifests/data_quality_report.json 어휘규모·hapax·상위명사·의미통계
"""
from __future__ import annotations
import glob, json, os
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROC = os.path.join(ROOT, "data", "processed")
CORP = os.path.join(PROC, "corpus")
SENSE = os.path.join(PROC, "senses")
MAN = os.path.join(ROOT, "data", "manifests")


def main():
    os.makedirs(MAN, exist_ok=True)
    dom_sent = Counter(); dom_tok = Counter(); dom_noun_tok = Counter()
    noun_total = Counter(); noun_dom = {"written": Counter(), "spoken": Counter()}
    pos_tok = Counter()

    for dom in ("written", "spoken"):
        for path in sorted(glob.glob(os.path.join(CORP, dom, "*.jsonl"))):
            with open(path, encoding="utf-8") as f:
                for line in f:
                    try:
                        t = json.loads(line)["t"]
                    except Exception:
                        continue
                    dom_sent[dom] += 1
                    dom_tok[dom] += len(t)
                    for w, p in t:
                        pos_tok[p] += 1
                        if p == "N":
                            dom_noun_tok[dom] += 1
                            noun_total[w] += 1
                            noun_dom[dom][w] += 1

    # 명사 빈도 테이블
    with open(os.path.join(PROC, "noun_freq.tsv"), "w", encoding="utf-8") as f:
        for w, c in noun_total.most_common():
            f.write(f"{w}\t{c}\t{noun_dom['written'][w]}\t{noun_dom['spoken'][w]}\n")

    # 의미 병합(다층위 WSD)
    senses = Counter(); sense_meta = {}
    for path in sorted(glob.glob(os.path.join(SENSE, "*.jsonl"))):
        with open(path, encoding="utf-8") as f:
            for line in f:
                r = json.loads(line)
                k = (r["lemma"], r["sense_id"], r["pos"])
                senses[k] += r["count"]; sense_meta[k] = r["pos"]
    with open(os.path.join(PROC, "senses_merged.jsonl"), "w", encoding="utf-8") as f:
        for (lemma, sid, pos), c in sorted(senses.items()):
            f.write(json.dumps({"lemma": lemma, "sense_id": sid, "pos": pos, "count": c},
                               ensure_ascii=False) + "\n")
    multi = defaultdict(set)
    for (lemma, sid, _) in senses:
        multi[lemma].add(sid)
    polysemous = {l: sorted(s) for l, s in multi.items() if len(s) > 1}

    # 매니페스트(데이터 사전)
    manifest = {
        "phase": "1 · 말뭉치 전처리",
        "sources_used": {
            "다층위구조분석말뭉치(SXML구어/NXML문어)": "MP(형태)+WSD(의미) 주석 직접 사용",
            "문어말뭉치(WRITTEN)": "paragraph.form → kiwi 형태소분석",
            "일상대화말뭉치(DIALOGUE)": "utterance.form → kiwi 형태소분석",
        },
        "sources_excluded": {
            "형태말뭉치(MP)": "다층위와 문서 100% 중복(부분집합) → 중복계산 방지(§3)로 제외",
            "NIKLex": "관계축(Phase 5)에서 별도 사용 — 코퍼스 아님",
        },
        "domains": {
            d: {"sentences": dom_sent[d], "content_tokens": dom_tok[d],
                "noun_tokens": dom_noun_tok[d]} for d in ("written", "spoken")},
        "totals": {"sentences": sum(dom_sent.values()),
                   "content_tokens": sum(dom_tok.values()),
                   "noun_tokens": sum(dom_noun_tok.values())},
        "token_pos_distribution": {"N_명사": pos_tok["N"], "V_용언기본형": pos_tok["V"],
                                   "M_일반부사": pos_tok["M"]},
        "outputs": ["noun_freq.tsv", "senses_merged.jsonl", "relations.jsonl(Phase5)"],
        "db_loaded": False,
        "note": "원본 말뭉치는 Postgres 미적재(§9). 로컬 중간산출만.",
    }
    with open(os.path.join(MAN, "data_manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    # 품질 리포트
    hapax = sum(1 for _, c in noun_total.items() if c == 1)
    quality = {
        "noun_vocabulary": {
            "unique": len(noun_total),
            "hapax(빈도1)": hapax,
            "hapax_ratio": round(hapax / max(1, len(noun_total)), 4),
            "freq>=5": sum(1 for _, c in noun_total.items() if c >= 5),
            "freq>=10": sum(1 for _, c in noun_total.items() if c >= 10),
            "freq>=20": sum(1 for _, c in noun_total.items() if c >= 20),
        },
        "top_nouns": [[w, c] for w, c in noun_total.most_common(40)],
        "senses_wsd": {
            "unique_lemma_sense": len(senses),
            "polysemous_lemmas(의미≥2)": len(polysemous),
            "sample_polysemous": dict(list(polysemous.items())[:15]),
        },
        "validation_pairs_present": {
            p: all(w in noun_total for w in p.split("~"))
            for p in ["나무~소나무", "나무~도토리", "나무~버섯", "나무~숲",
                      "나무~질책", "여름~겨울"]},
    }
    with open(os.path.join(MAN, "data_quality_report.json"), "w", encoding="utf-8") as f:
        json.dump(quality, f, ensure_ascii=False, indent=2)

    print("=== Phase 1 데이터 사전 ===")
    print(f"  문장 {manifest['totals']['sentences']:,} · 내용어토큰 {manifest['totals']['content_tokens']:,}")
    print(f"  명사토큰 {manifest['totals']['noun_tokens']:,} · 고유명사 {len(noun_total):,}")
    print(f"  freq>=10 명사 {quality['noun_vocabulary']['freq>=10']:,} · hapax비율 {quality['noun_vocabulary']['hapax_ratio']}")
    print(f"  WSD 의미 {len(senses):,} · 다의어 표제어 {len(polysemous):,}")
    print(f"  검증쌍 어휘존재: {quality['validation_pairs_present']}")


if __name__ == "__main__":
    main()
