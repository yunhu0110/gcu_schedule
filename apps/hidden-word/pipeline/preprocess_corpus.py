"""
preprocess_corpus.py — Phase 1: 말뭉치 전처리 (지시서 §5 기반 데이터 생성의 토대)

NIKL 5종 중 4종을 정규화된 '문장별 내용어 토큰열'로 변환한다.
  · 한국어다층위구조분석말뭉치(SXML=구어, NXML=문어): MP(형태) 주석을 그대로 사용(kiwi 불필요),
    WSD(어휘의미) 주석에서 명사 의미ID(표제어·sense_id·품사)를 수집 → Phase 2 word_senses 토대.
  · 문어말뭉치(WRITTEN): paragraph.form 원문을 kiwi 로 형태소 분석.
  · 일상대화말뭉치(DIALOGUE): utterance.form 원문을 kiwi 로 형태소 분석.
  · 형태말뭉치(MP)는 제외 — 다층위와 문서가 100% 겹치는 부분집합이라 중복 계산(§3) 방지.

도메인 분리(§4): 문어/구어를 별도 도메인으로 보존해 이후 축에서 독립 정규화한다.
  written = 문어말뭉치 + 다층위 NXML,  spoken = 일상대화말뭉치 + 다층위 SXML.

산출(apps/hidden-word/data/processed/, DB 미적재·gitignore):
  corpus/<domain>/<srcid>.jsonl   한 줄 = {"d":도메인,"s":문장id,"t":[[표면형,품사약어],...]}
                                  품사약어 N=명사(NNG/NNP) V=용언(VV/VA 기본형) M=일반부사(MAG)
  senses/<srcid>.jsonl            다층위 WSD 명사 의미: {"lemma","sense_id","pos","count"}
  checkpoint.json                 완료 소스파일 목록(중간 재개용)
  preprocess.log                  진행 로그

주의(§9/보안): 원본은 읽기만 한다. 원본 말뭉치를 Postgres 에 적재하지 않는다(로컬 중간산출만).
             연결문자열/비밀번호는 다루지 않는다(이 단계는 DB 접속 없음).

실행:
  .venv/bin/python preprocess_corpus.py --sample 3     # 소스별 3파일만(검증용)
  .venv/bin/python preprocess_corpus.py                # 전체
  .venv/bin/python preprocess_corpus.py --only written # 특정 도메인만
"""
from __future__ import annotations
import argparse, glob, json, os, re, sys, time
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # apps/hidden-word
KOREAN = os.path.join(ROOT, "korean")
OUT = os.path.join(ROOT, "data", "processed")
CORP = os.path.join(OUT, "corpus")
SENSE = os.path.join(OUT, "senses")
CKPT = os.path.join(OUT, "checkpoint.json")
LOG = os.path.join(OUT, "preprocess.log")

HANGUL = re.compile(r"^[가-힣]{1,16}$")
NOUN = {"NNG", "NNP"}
PRED = {"VV", "VA"}
ADV = {"MAG"}
_WS = re.compile(r"\s+")


def norm(s: str) -> str:
    return _WS.sub("", (s or "").strip())


def _logf(msg: str):
    line = f"[{time.strftime('%H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


# ── kiwi (지연 로드, 멀티워커) ───────────────────────────────────────────────
_kiwi = None


def kiwi(num_workers: int):
    global _kiwi
    if _kiwi is None:
        from kiwipiepy import Kiwi
        _kiwi = Kiwi(num_workers=num_workers)
    return _kiwi


def toks_from_kiwi_tokens(tokens) -> list[list[str]]:
    """kiwi Token 목록 → [[표면형, 약어]] 내용어만."""
    out = []
    for t in tokens:
        if t.tag in NOUN:
            f = norm(t.form)
            if HANGUL.match(f):
                out.append([f, "N"])
        elif t.tag in PRED:
            f = norm(t.form)
            if f and HANGUL.match(f):           # 용언 어간 → 기본형(+다)
                out.append([f + "다", "V"])
        elif t.tag in ADV:
            f = norm(t.form)
            if HANGUL.match(f):
                out.append([f, "M"])
    return out


def toks_from_mp(mp: list[dict]) -> list[list[str]]:
    """다층위 MP(형태) 주석 → 내용어 토큰열."""
    out = []
    for m in mp:
        lab, form = m.get("label"), norm(m.get("form", ""))
        if lab in NOUN and HANGUL.match(form):
            out.append([form, "N"])
        elif lab in PRED and form and HANGUL.match(form):
            out.append([form + "다", "V"])
        elif lab in ADV and HANGUL.match(form):
            out.append([form, "M"])
    return out


# ── 체크포인트 ───────────────────────────────────────────────────────────────
def load_ckpt() -> set[str]:
    if os.path.exists(CKPT):
        with open(CKPT, encoding="utf-8") as f:
            return set(json.load(f).get("done", []))
    return set()


def save_ckpt(done: set[str]):
    tmp = CKPT + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump({"done": sorted(done)}, f, ensure_ascii=False)
    os.replace(tmp, CKPT)


def write_shard(domain: str, srcid: str, lines: list[str]):
    d = os.path.join(CORP, domain)
    os.makedirs(d, exist_ok=True)
    tmp = os.path.join(d, srcid + ".jsonl.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
        if lines:
            f.write("\n")
    os.replace(tmp, os.path.join(d, srcid + ".jsonl"))


# ── 소스별 처리기 ─────────────────────────────────────────────────────────────
def process_written(path: str, nworkers: int) -> tuple[int, int]:
    """문어말뭉치 1파일: paragraph.form → kiwi. (문장수, 토큰수)"""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    srcid = os.path.splitext(os.path.basename(path))[0]
    units = []  # (sid, text)
    for d in doc.get("document", []):
        for p in d.get("paragraph", []):
            form = norm(p.get("form", ""))
            if form:
                units.append((p.get("id", ""), form))
    return _kiwi_units("written", srcid, units, nworkers=nworkers)


def process_dialogue(path: str, nworkers: int) -> tuple[int, int]:
    """일상대화말뭉치 1파일: utterance.form → kiwi."""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    srcid = os.path.splitext(os.path.basename(path))[0]
    units = []
    for d in doc.get("document", []):
        for u in d.get("utterance", []):
            form = norm(u.get("form", ""))
            if form:
                units.append((u.get("id", ""), form))
    return _kiwi_units("spoken", srcid, units, nworkers=nworkers)


def _kiwi_units(domain: str, srcid: str, units: list, nworkers: int) -> tuple[int, int]:
    if not units:
        write_shard(domain, srcid, [])
        return 0, 0
    texts = [t for _, t in units]
    k = kiwi(nworkers)
    results = k.tokenize(texts)  # 멀티워커 제너레이터
    lines, ntok = [], 0
    for (sid, _), tokens in zip(units, results):
        t = toks_from_kiwi_tokens(tokens)
        if t:
            ntok += len(t)
            lines.append(json.dumps({"d": domain, "s": sid, "t": t}, ensure_ascii=False))
    write_shard(domain, srcid, lines)
    return len(lines), ntok


def process_multilayer(path: str) -> tuple[int, int, int]:
    """다층위 1파일: MP → 토큰열, WSD → 명사 의미ID. 파일명 접두 S=구어/N=문어."""
    with open(path, encoding="utf-8") as f:
        doc = json.load(f)
    srcid = os.path.splitext(os.path.basename(path))[0]
    domain = "spoken" if srcid.startswith("S") else "written"
    lines, ntok = [], 0
    senses = Counter()  # (lemma, sense_id, pos) → count
    for d in doc.get("document", []):
        for s in d.get("sentence", []):
            mp = s.get("MP") or []
            t = toks_from_mp(mp)
            if t:
                ntok += len(t)
                lines.append(json.dumps(
                    {"d": domain, "s": s.get("id", ""), "t": t}, ensure_ascii=False))
            for w in (s.get("WSD") or []):
                pos = w.get("pos")
                if pos in NOUN:
                    lemma = norm(w.get("form", ""))
                    sid = w.get("sense_id")
                    if HANGUL.match(lemma) and sid:
                        senses[(lemma, sid, pos)] += 1
    write_shard(domain, srcid, lines)
    os.makedirs(SENSE, exist_ok=True)
    spath = os.path.join(SENSE, srcid + ".jsonl")
    with open(spath, "w", encoding="utf-8") as f:
        for (lemma, sid, pos), c in sorted(senses.items()):
            f.write(json.dumps({"lemma": lemma, "sense_id": sid, "pos": pos, "count": c},
                               ensure_ascii=False) + "\n")
    return len(lines), ntok, len(senses)


# ── 소스 디스커버리 ──────────────────────────────────────────────────────────
def discover() -> dict:
    return {
        "written": sorted(glob.glob(os.path.join(KOREAN, "문어말뭉치", "*", "*.json"))),
        "spoken": sorted(glob.glob(os.path.join(KOREAN, "일상대화말뭉치", "*", "*.json"))),
        "multilayer": sorted(glob.glob(os.path.join(KOREAN, "한국어다층위구조분석말뭉치", "*.json"))),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0, help="소스별 N파일만(검증)")
    ap.add_argument("--only", choices=["written", "spoken", "multilayer"], help="한 소스만")
    ap.add_argument("--workers", type=int, default=8, help="kiwi 멀티워커 수")
    args = ap.parse_args()

    os.makedirs(CORP, exist_ok=True)
    srcs = discover()
    if args.only:
        srcs = {args.only: srcs[args.only]}
    if args.sample:
        srcs = {k: v[: args.sample] for k, v in srcs.items()}

    done = load_ckpt()
    _logf(f"=== 전처리 시작 (sample={args.sample or '전체'}, workers={args.workers}) ===")
    for k, v in srcs.items():
        _logf(f"  소스 {k}: {len(v)}파일 (완료 {sum(1 for p in v if p in done)})")

    tot_sent = tot_tok = tot_sense = 0
    t0 = time.time()
    for kind, files in srcs.items():
        for i, path in enumerate(files):
            if path in done:
                continue
            try:
                if kind == "written":
                    ns, nt = process_written(path, args.workers); nse = 0
                elif kind == "spoken":
                    ns, nt = process_dialogue(path, args.workers); nse = 0
                else:
                    ns, nt, nse = process_multilayer(path)
            except Exception as e:
                _logf(f"  ✗ 실패 {os.path.basename(path)}: {type(e).__name__}: {e}")
                continue
            tot_sent += ns; tot_tok += nt; tot_sense += nse
            done.add(path)
            if (i + 1) % 200 == 0 or kind == "multilayer":
                save_ckpt(done)
                el = time.time() - t0
                _logf(f"  [{kind}] {i+1}/{len(files)}  문장누계 {tot_sent:,}  "
                      f"토큰 {tot_tok:,}  의미 {tot_sense:,}  ({el:.0f}s)")
        save_ckpt(done)
        _logf(f"  ✓ {kind} 완료")

    save_ckpt(done)
    _logf(f"=== 완료: 문장 {tot_sent:,} · 토큰 {tot_tok:,} · 명사의미 {tot_sense:,} "
          f"· {time.time()-t0:.0f}s ===")


if __name__ == "__main__":
    main()
