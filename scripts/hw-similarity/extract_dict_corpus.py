"""
우리말샘 opendict XML → 평문 코퍼스 (축2 문맥 PPMI 입력용)

각 senseInfo 의 뜻풀이(definition) + 예문(example_info/example) 텍스트를 한 줄씩 뽑는다.
풀 단어(바다/학교/사과…)는 자기 표제어의 정의·예문뿐 아니라 '관련 단어'의 정의·예문에도
자주 등장하므로, 사전 전체 정의/예문을 코퍼스로 쓰면 풀앵커 공기(co-occurrence)를 얻는다.

실행:
  python extract_dict_corpus.py --src data/opendict --out corpus_dict
"""
from __future__ import annotations
import argparse, glob, os, re
import xml.etree.ElementTree as ET

_BRACE = re.compile(r"[{}]")          # 예문 강조표시 {표제어} 제거
_WS = re.compile(r"\s+")


def clean(s: str) -> str:
    s = _BRACE.sub("", s)
    s = _WS.sub(" ", s).strip()
    return s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default="data/opendict")
    ap.add_argument("--out", default="corpus_dict")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    files = sorted(glob.glob(os.path.join(args.src, "*.xml")))
    print(f"XML {len(files)}개 처리")

    n_def = n_ex = 0
    out_path = os.path.join(args.out, "dict.txt")
    with open(out_path, "w", encoding="utf-8") as out:
        for fi, path in enumerate(files, 1):
            for _, item in ET.iterparse(path, events=("end",)):
                if item.tag != "item":
                    continue
                for si in item.findall("senseInfo"):
                    d = si.findtext("definition", "")
                    if d:
                        c = clean(d)
                        if len(c) > 1:
                            out.write(c + "\n"); n_def += 1
                    for ei in si.findall("example_info"):
                        ex = ei.findtext("example", "")
                        if ex:
                            c = clean(ex)
                            if len(c) > 1:
                                out.write(c + "\n"); n_ex += 1
                item.clear()
            print(f"  [{fi}/{len(files)}] {os.path.basename(path)}  누적 정의 {n_def} 예문 {n_ex}", flush=True)

    size_mb = os.path.getsize(out_path) / 1024 / 1024
    print(f"완료: {out_path}  정의 {n_def} + 예문 {n_ex} 줄, {size_mb:.1f} MB")


if __name__ == "__main__":
    main()
