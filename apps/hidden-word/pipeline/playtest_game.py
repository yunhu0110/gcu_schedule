"""
playtest_game.py — 3인 게임 한 판을 실제 Supabase RPC로 끝까지 시뮬레이션.
'라운드=바퀴' 정의(0044) 검증: total_rounds(바퀴) × 인원수 = 총 출제 턴, 마지막 턴에만 game_over.
라운드마다 출제자 1명·추측자 2명(정답1·오답1)으로 채점 양쪽 경로를 검증.
규칙 #3(봉투 비공개)·#7(단어 재사용 금지: 같은 출제자가 매 턴 다른 힌트)·#9/#10(유사도)·
#11(95 게이트)·채점·바퀴 로테이션·게임오버 검증. 끝나면 테스트 방을 삭제(cascade)해 DB를 원복한다.
"""
import os, json, uuid, psycopg

ENV = "/Users/yunhu/gcu_schedule/scripts/hw-similarity/.env.local"
TOTAL_ROUNDS = 2   # 바퀴 수 → 3명이면 총 6턴
N = 3

u = None
for line in open(ENV):
    if line.startswith("SUPABASE_DB_URL="):
        u = line.split("=", 1)[1].strip().strip('"').strip("'")

PASS, FAIL = [], []
def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗ 실패'} {name}{(' — '+extra) if extra else ''}")

def rpc(cur, fn, *args):
    ph = ",".join(["%s"] * len(args))
    cur.execute(f"select public.{fn}({ph})", args)
    return cur.fetchone()[0]

def candidates_for(cur, hidden, k=50):
    """hidden 의 임베딩 최근접 이웃 k개를 합성 유사도와 함께 (단어, 유사도) desc 로 반환."""
    cur.execute("""
      select nn.w, (sc.score)::float from (
        select ea2.word w from public.hw_word_embeddings ea
        join public.hw_word_embeddings ea2 on ea2.word <> ea.word
        where ea.word = %s order by ea.vec <=> ea2.vec limit %s
      ) nn, lateral public.hw_word_similarity(%s, nn.w) sc
      order by sc.score desc
    """, (hidden, k, hidden))
    return [(w, s) for w, s in cur.fetchall()]

with psycopg.connect(u, autocommit=True) as c, c.cursor() as cur:
    cur.execute("set statement_timeout=0")
    print("=== 1) 방 생성 + 참가 (3인) ===")
    r1 = rpc(cur, "hw_create_room", "플레이테스트", 6, "앨리스", "#c9a24b", False)
    code, room_id, t1, p1 = r1["code"], r1["room_id"], r1["token"], r1["player_id"]
    print(f"  방 {code} 생성 · 호스트 앨리스")
    r2 = rpc(cur, "hw_join_room", code, "밥", "#6b8fd4")
    t2, p2 = r2["token"], r2["player_id"]
    r3 = rpc(cur, "hw_join_room", code, "찰리", "#5fd38a")
    t3, p3 = r3["token"], r3["player_id"]
    print("  밥·찰리 참가")
    rpc(cur, "hw_set_ready", t2, True)
    rpc(cur, "hw_set_ready", t3, True)

    print(f"=== 2) 게임 시작 (total_rounds={TOTAL_ROUNDS} 바퀴) ===")
    rpc(cur, "hw_start_game", t1, TOTAL_ROUNDS)
    cur.execute("select state from public.hw_rooms where id=%s", (room_id,))
    st = cur.fetchone()[0]
    check("시작 후 phase=envelope_selection", st["phase"] == "envelope_selection", st["phase"])
    check(f"total_rounds={TOTAL_ROUNDS} 저장(바퀴)", st.get("total_rounds") == TOTAL_ROUNDS, str(st.get("total_rounds")))
    order = st["player_order"]
    check("player_order 3명", len(order) == N)

    print("=== 3) 봉투 선택 (번호만, 내용 비공개 #3) ===")
    cur.execute("""select column_name from information_schema.columns
                   where table_schema='public' and table_name='hw_envelopes'""")
    cols = {r[0] for r in cur.fetchall()}
    check("hw_envelopes 공개 테이블에 words 없음(#3)", "words" not in cols and "envelope_number" in cols)
    rpc(cur, "hw_select_envelope", t1, 1)
    rpc(cur, "hw_select_envelope", t2, 2)
    rpc(cur, "hw_select_envelope", t3, 3)
    cur.execute("select state from public.hw_rooms where id=%s", (room_id,))
    st = cur.fetchone()[0]
    check("전원 봉투 선택 후 phase=hidden_word_selection", st["phase"] == "hidden_word_selection", st["phase"])

    print(f"=== 4) 히든워드 선택 (각 바퀴마다 다른 ≥95 힌트가 {TOTAL_ROUNDS}개 이상 가능한 단어로) ===")
    best = {}  # pid -> (hidden, [strong...], (weak_word, weak_sim))
    for tok, pid, nm in [(t1, p1, "앨리스"), (t2, p2, "밥"), (t3, p3, "찰리")]:
        words = rpc(cur, "hw_get_my_envelope", tok)
        pick = None
        for w in words:
            cands = candidates_for(cur, w)
            strong = [cw for cw, s in cands if s >= 95.0]
            weak = cands[-1] if cands else (None, 0.0)  # 50번째 이웃 → 낮은 유사도
            if pick is None or len(strong) > len(pick[1]):
                pick = (w, strong, weak)
        hidden, strong, weak = pick
        check(f"{nm}: 히든='{hidden}' 강한힌트 후보 {len(strong)}개 ≥ {TOTAL_ROUNDS}(바퀴마다 다른 힌트 #7)",
              len(strong) >= TOTAL_ROUNDS, f"strong={strong[:TOTAL_ROUNDS]}")
        rpc(cur, "hw_select_hidden_word", tok, hidden)
        best[pid] = (hidden, strong, weak)
        print(f"  {nm}: 히든워드='{hidden}' · 강한힌트{strong[:TOTAL_ROUNDS]} · 약한힌트'{weak[0]}'≈{weak[1]:.1f}")
    cur.execute("select state from public.hw_rooms where id=%s", (room_id,))
    st = cur.fetchone()[0]
    check("전원 히든워드 선택 후 phase=round", st["phase"] == "round", st["phase"])

    tok_of = {p1: t1, p2: t2, p3: t3}
    name_of = {p1: "앨리스", p2: "밥", p3: "찰리"}

    def revealed_map():
        cur.execute("select player_id, hidden_word from public.hw_revealed_words(%s)", (room_id,))
        return {str(pid): hw for pid, hw in cur.fetchall()}

    print(f"=== 5) 라운드 진행 (총 {TOTAL_ROUNDS}바퀴 × {N}명 = {TOTAL_ROUNDS*N}턴) ===")
    total_turns = TOTAL_ROUNDS * N
    used_clue = {p1: set(), p2: set(), p3: set()}  # #7: 출제자별 사용한 힌트
    guard_done = False
    for turn in range(total_turns):
        cur.execute("select state from public.hw_rooms where id=%s", (room_id,))
        st = cur.fetchone()[0]
        ri = st["round_index"]
        check(f"턴{turn}: round_index 일치", ri == turn, f"ri={ri}")
        cycle = turn // N + 1
        giver = order[ri % N]
        guessers = [p for p in order if p != giver]
        correct_g, wrong_g = guessers[0], guessers[1]
        hidden, strong, weak = best[giver]
        print(f"\n  ── {cycle}바퀴 · 턴{turn} · 출제자 {name_of[giver]} (히든='{hidden}') ──")

        if not guard_done:
            try:
                rpc(cur, "hw_submit_guess", tok_of[correct_g], hidden)
                check("개방 전 추측 거부(#11)", False, "거부되지 않음")
            except Exception:
                check("개방 전 추측 거부(#11)", True)
            try:
                rpc(cur, "hw_submit_clue", tok_of[giver], hidden)
                check("힌트=히든워드 거부", False, "거부되지 않음")
            except Exception:
                check("힌트=히든워드 거부", True)
            # 약한 힌트로는 게이트가 닫혀 있어야 함 (#11)
            if weak[0] and weak[0] != hidden and weak[1] < 95:
                rw = rpc(cur, "hw_submit_clue", tok_of[giver], weak[0])
                print(f"    약한 힌트 '{weak[0]}' → 유사도 {rw['similarity']} · 개방={rw['unlocked']}")
                check("약한 힌트로는 미개방(#11)", not rw["unlocked"] and rw["similarity"] < 95)
                used_clue[giver].add(weak[0])
            guard_done = True

        # 이번 턴 강한 힌트: 이 출제자가 아직 안 쓴 ≥95 단어 (#7 재사용 금지)
        sc = next((s for s in strong if s not in used_clue[giver]), None)
        check(f"턴{turn}: 미사용 강한힌트 확보(#7)", sc is not None, f"used={used_clue[giver]}")
        used_clue[giver].add(sc)
        rs = rpc(cur, "hw_submit_clue", tok_of[giver], sc)
        print(f"    강한 힌트 '{sc}' → 유사도 {rs['similarity']} · 개방={rs['unlocked']}")
        check(f"턴{turn}: 강한 힌트 ≥95 개방(#11)", rs["unlocked"] and rs["similarity"] >= 95, f"sim={rs['similarity']}")

        cur.execute("select player_id, points from public.hw_scores where room_id=%s", (room_id,))
        before = {str(pid): pts for pid, pts in cur.fetchall()}

        rg1 = rpc(cur, "hw_submit_guess", tok_of[correct_g], hidden)
        check(f"턴{turn}: 첫 추측 후 미정산", rg1["all_guessed"] is False, str(rg1))
        rg2 = rpc(cur, "hw_submit_guess", tok_of[wrong_g], "절대아닌단어ZZZ")
        last = (turn == total_turns - 1)
        print(f"    {name_of[correct_g]}=정답 · {name_of[wrong_g]}=오답 → all_guessed={rg2['all_guessed']} game_over={rg2.get('game_over')}")
        check(f"턴{turn}: 전원 추측 후 정산", rg2["all_guessed"])
        # 바퀴 핵심 검증: 마지막 턴에만 game_over
        check(f"턴{turn}: game_over={last} (마지막 턴에만)", bool(rg2.get("game_over")) == last,
              f"game_over={rg2.get('game_over')}, last={last}")

        revmap = revealed_map()
        check(f"턴{turn}: 정답 공개", revmap.get(str(giver)) == hidden, f"공개='{revmap.get(str(giver))}'")

        cur.execute("select player_id, points from public.hw_scores where room_id=%s", (room_id,))
        after = {str(pid): pts for pid, pts in cur.fetchall()}
        check(f"턴{turn}: 정답자 가점", after.get(str(correct_g), 0) > before.get(str(correct_g), 0),
              f"{before.get(str(correct_g),0)}→{after.get(str(correct_g),0)}")
        check(f"턴{turn}: 오답자 무가점", after.get(str(wrong_g), 0) == before.get(str(wrong_g), 0),
              f"{before.get(str(wrong_g),0)}→{after.get(str(wrong_g),0)}")
        check(f"턴{turn}: 출제자 가점", after.get(str(giver), 0) > before.get(str(giver), 0),
              f"{before.get(str(giver),0)}→{after.get(str(giver),0)}")

    print("\n=== 6) 게임오버 ===")
    cur.execute("select state, status from public.hw_rooms where id=%s", (room_id,))
    st, status = cur.fetchone()
    check(f"{TOTAL_ROUNDS}바퀴({total_turns}턴) 후 phase=game_over", st["phase"] == "game_over", st["phase"])
    cur.execute("select player_id, points from public.hw_scores where room_id=%s order by points desc", (room_id,))
    scores = cur.fetchall()
    print("  최종 점수:", {name_of.get(str(pid), str(pid)[:4]): pts for pid, pts in scores})

    print("\n=== 7) #7 단어 재사용 금지 (유니크 인덱스 + 매 턴 다른 힌트 실증) ===")
    cur.execute("""select indexdef from pg_indexes where schemaname='public'
                   and tablename='hw_clues' and indexdef ilike '%unique%'""")
    idx = cur.fetchall()
    check("hw_clues 재사용 방지 유니크 인덱스 존재(#7)", any("clue_word" in d[0] for d in idx),
          str([d[0].split(' ON ')[0] for d in idx]))

    print("\n=== 8) 테스트 방 정리(cascade 삭제) ===")
    cur.execute("delete from public.hw_rooms where id=%s", (room_id,))
    cur.execute("select count(*) from public.hw_rooms where id=%s", (room_id,))
    check("테스트 방 삭제됨", cur.fetchone()[0] == 0)
    cur.execute("select count(*) from public.hw_words")
    check("어휘 데이터 보존(104,595)", cur.fetchone()[0] == 104595)

print(f"\n{'='*40}\n결과: {len(PASS)} 통과 / {len(FAIL)} 실패")
if FAIL:
    print("실패 항목:", FAIL)
    raise SystemExit(1)
print("✅ 전 항목 통과")
