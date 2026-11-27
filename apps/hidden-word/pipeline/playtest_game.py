"""
playtest_game.py — 새 엔진(0045~0048) 한 판 시뮬레이션 (Phase 1).
검증 대상:
  · 봉투는 매 라운드 새로 생성, 개수 = 참가자 수(§3·§4), 봉투 공개테이블에 words 없음(§3)
  · 전 라운드 봉투 단어가 서로 전역 중복 없음(이전 라운드 전체 단어 재사용 금지, §3)
  · total_problems = 인원 × 라운드, player_order 시작 시 1회 추첨·모든 라운드 동일 유지(§4)
  · 한 문제 최대 3회차 재도전: 회차마다 힌트→추측, 오답 전원 시 다음 회차(같은 히든워드 유지)
  · 힌트 10개 소진 시 ≥95 미도달 → 회차 실패(다음 회차로)
  · ≥95 게이트(§11), §7 힌트 단어 재사용 금지, 유사도 공개(§9·§10)
  · 문제 정산 시 해당 라운드 히든워드 공개, 마지막 문제에만 game_over
  · 점수(최종·배율 없음): 정답자 각 +1 / 출제자=(해결회차-1)*해결회차/2 / 미해결 6점 — 정확 검증
끝나면 테스트 방을 삭제(cascade)해 DB를 원복한다.
"""
import psycopg

ENV = "/Users/yunhu/gcu_schedule/scripts/hw-similarity/.env.local"
R = 2   # 라운드(바퀴) 수
N = 3

u = next(l.split("=", 1)[1].strip().strip('"').strip("'")
         for l in open(ENV) if l.startswith("SUPABASE_DB_URL="))

PASS, FAIL = [], []
def check(name, cond, extra=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✓' if cond else '✗ 실패'} {name}{(' — ' + extra) if extra else ''}")

def rpc(cur, fn, *args):
    cur.execute(f"select public.{fn}({','.join(['%s'] * len(args))})", args)
    return cur.fetchone()[0]

def cands(cur, hidden, k=80):
    cur.execute("""
      select nn.w,(sc.score)::float from (
        select ea2.word w from public.hw_word_embeddings ea
        join public.hw_word_embeddings ea2 on ea2.word<>ea.word
        where ea.word=%s order by ea.vec<=>ea2.vec limit %s
      ) nn, lateral public.hw_word_similarity(%s,nn.w) sc order by sc.score desc
    """, (hidden, k, hidden))
    return cur.fetchall()

def state(cur, rid):
    cur.execute("select state from public.hw_rooms where id=%s", (rid,))
    return cur.fetchone()[0]

def points(cur, rid):
    cur.execute("select player_id, points from public.hw_scores where room_id=%s", (rid,))
    return {str(p): pt for p, pt in cur.fetchall()}

with psycopg.connect(u, autocommit=True) as c, c.cursor() as cur:
    cur.execute("set statement_timeout=0")

    print("=== 1) 방 생성 + 참가 (3인) ===")
    r1 = rpc(cur, "hw_create_room", "플레이테스트", 6, "앨리스", "#c9a24b", False)
    code, rid, t1, p1 = r1["code"], r1["room_id"], r1["token"], r1["player_id"]
    r2 = rpc(cur, "hw_join_room", code, "밥", "#6b8fd4"); t2, p2 = r2["token"], r2["player_id"]
    r3 = rpc(cur, "hw_join_room", code, "찰리", "#5fd38a"); t3, p3 = r3["token"], r3["player_id"]
    rpc(cur, "hw_set_ready", t2, True); rpc(cur, "hw_set_ready", t3, True)
    tok = {p1: t1, p2: t2, p3: t3}
    nm = {p1: "앨리스", p2: "밥", p3: "찰리"}

    print(f"=== 2) 게임 시작 (라운드={R}) ===")
    sg = rpc(cur, "hw_start_game", t1, R)
    check("total_problems = 인원×라운드", sg["total_problems"] == N * R, str(sg))
    st = state(cur, rid)
    check("phase=envelope_selection", st["phase"] == "envelope_selection", st["phase"])
    check("total_problems state 저장", st["total_problems"] == N * R)
    order = st["player_order"]
    check("player_order N명", len(order) == N)
    cur.execute("select count(*) from public.hw_envelopes where room_id=%s", (rid,))
    check("봉투 개수 = 인원수(§4)", cur.fetchone()[0] == N, "")
    cur.execute("""select column_name from information_schema.columns
                   where table_schema='public' and table_name='hw_envelopes'""")
    cols = {r[0] for r in cur.fetchall()}
    check("봉투 공개테이블에 words 없음(§3)", "words" not in cols)

    used_clue = {p: set() for p in order}   # §7 전역 힌트 재사용 금지
    used_word = {p: set() for p in order}   # §6 히든워드 재사용 금지
    all_env_words = []                       # §3 전 라운드 봉투 단어 누적(전역 중복 검사)
    env_words = {}                           # 현재 라운드 봉투 단어(라운드마다 재조회)
    neigh = {}                               # (pid, word) -> (strong[list], weak[list])
    did_prog = did_cap = did_fail = False

    def pick_word(p):
        """이 라운드용 히든워드: 아직 안 쓴 단어 중 사용가능 strong 이웃이 가장 많은 것."""
        best = None
        for w in env_words[p]:
            if w in used_word[p]:
                continue
            s = [x for x in neigh[(p, w)][0] if x not in used_clue[p]]
            if best is None or len(s) > len(best[1]):
                best = (w, s)
        return best  # (word, strong_unused)

    def guess_all(gssrs, giver, hidden, wrong=False):
        resp = None
        for i, g in enumerate(gssrs):
            word = (f"절대아닌단어Z{i}" if wrong else hidden)
            resp = rpc(cur, "hw_submit_guess", tok[g], word)
        return resp

    for rnd in range(1, R + 1):
        print(f"\n########## 라운드 {rnd} ##########")

        # (A) 매 라운드 새 봉투 선택(§3) — round1 은 start 직후, round≥2 는 정산 전이 후
        st = state(cur, rid)
        check(f"R{rnd}: phase=envelope_selection", st["phase"] == "envelope_selection", st["phase"])
        check(f"R{rnd}: round_no={rnd}", st["round_no"] == rnd, str(st["round_no"]))
        cur.execute("select count(*) from public.hw_envelopes where room_id=%s and round_no=%s", (rid, rnd))
        check(f"R{rnd}: 봉투 개수 = 인원수(§4)", cur.fetchone()[0] == N, "")
        for i, p in enumerate(order, 1):
            rpc(cur, "hw_select_envelope", tok[p], i)
        check(f"R{rnd}: 전원 선택 후 phase=hidden_word_selection",
              state(cur, rid)["phase"] == "hidden_word_selection")

        # 이 라운드 봉투 단어 재조회 + 전역 중복 검사(§3: 전 라운드 모든 봉투 단어 재사용 금지)
        env_words = {p: rpc(cur, "hw_get_my_envelope", tok[p]) for p in order}
        flat = [w for p in order for w in env_words[p]]
        check(f"R{rnd}: 봉투 단어 라운드 내 중복 없음", len(set(flat)) == len(flat))
        overlap = set(flat) & set(all_env_words)
        check(f"R{rnd}: 이전 라운드 단어와 전역 중복 없음(§3)", not overlap, f"겹침={overlap}")
        all_env_words += flat

        # strong/weak 이웃 재계산(라운드마다 단어가 바뀜)
        neigh = {}
        for p in order:
            for w in env_words[p]:
                cs = cands(cur, w)
                neigh[(p, w)] = ([x for x, s in cs if s >= 95.0 and x != w],
                                 [x for x, s in cs if s < 90.0 and x != w])

        # (B) 히든워드 선택
        chosen = {}
        for p in order:
            pw = pick_word(p)
            check(f"R{rnd} {nm[p]}: 사용가능 strong 히든워드 확보", pw is not None and len(pw[1]) >= 1,
                  f"word={pw[0] if pw else None} strong={len(pw[1]) if pw else 0}")
            w, strong = pw
            rpc(cur, "hw_select_hidden_word", tok[p], w)
            used_word[p].add(w)
            chosen[p] = (w, strong)
        check(f"R{rnd}: 전원 선택 후 phase=round", state(cur, rid)["phase"] == "round")
        st = state(cur, rid)
        check("player_order 영속(불변·재셔플 없음, §4)", st["player_order"] == order)

        for gi in range(N):
            st = state(cur, rid)
            giver = order[gi]
            hidden, _ = chosen[giver]
            strong = [x for x in neigh[(giver, hidden)][0] if x not in used_clue[giver]]
            weak = [x for x in neigh[(giver, hidden)][1] if x not in used_clue[giver]]
            gssrs = [p for p in order if p != giver]
            is_last = (rnd == R and gi == N - 1)
            prob_no = (rnd - 1) * N + gi + 1
            check(f"R{rnd}P{gi}: giver_index={gi}", st["giver_index"] == gi, str(st["giver_index"]))
            check(f"R{rnd}P{gi}: problem_no={prob_no}", st["problem_no"] == prob_no, str(st["problem_no"]))
            check(f"R{rnd}P{gi}: 회차 1부터", st["attempt_no"] == 1, str(st["attempt_no"]))

            if not did_cap and len(weak) >= 10 and len(strong) >= 1:
                plan = "cap"
            elif not did_prog and len(strong) >= 3:
                plan = "prog3"
            elif not did_fail and len(strong) >= 3:
                plan = "fullfail"
            elif not did_prog and len(strong) >= 2:
                plan = "prog2"
            else:
                plan = "solve1"
            print(f"\n  ── R{rnd} 문제{gi} · 출제자 {nm[giver]} (히든='{hidden}') · plan={plan} "
                  f"(strong={len(strong)},weak={len(weak)}) ──")

            before = points(cur, rid)

            if plan == "cap":
                last = None
                for h in range(10):
                    cw = weak[h]; used_clue[giver].add(cw)
                    last = rpc(cur, "hw_submit_clue", tok[giver], cw)
                    if h in (0, 9):
                        check(f"  약힌트{h+1} 미개방(§11)", not last["unlocked"] and last["similarity"] < 95,
                              f"sim={last['similarity']}")
                check("  10힌트 소진 → 회차 실패", last.get("attempt_failed") and last.get("next_attempt") == 2,
                      str(last))
                check("  회차2로 전환(같은 히든워드)", state(cur, rid)["attempt_no"] == 2)
                sc = strong[0]; used_clue[giver].add(sc)
                ru = rpc(cur, "hw_submit_clue", tok[giver], sc)
                check("  회차2 강힌트 ≥95 개방", ru["unlocked"] and ru["attempt"] == 2, str(ru))
                fin = guess_all(gssrs, giver, hidden, wrong=False)
                check("  회차2 정답 → 문제 종료", fin.get("solved") and fin.get("problem_over"), str(fin))
                did_cap = True

            elif plan in ("prog2", "prog3"):
                target = 3 if plan == "prog3" else 2
                for a in range(1, target):
                    sc = strong[a - 1]; used_clue[giver].add(sc)
                    ru = rpc(cur, "hw_submit_clue", tok[giver], sc)
                    check(f"  회차{a} 개방(≥95)", ru["unlocked"] and ru["attempt"] == a, str(ru))
                    fr = guess_all(gssrs, giver, hidden, wrong=True)
                    check(f"  회차{a} 전원 오답 → 회차{a+1}", (not fr.get("solved")) and fr.get("next_attempt") == a + 1,
                          str(fr))
                    check(f"  회차{a+1} 전환·히든워드 유지", state(cur, rid)["attempt_no"] == a + 1)
                sc = strong[target - 1]; used_clue[giver].add(sc)
                ru = rpc(cur, "hw_submit_clue", tok[giver], sc)
                check(f"  회차{target} 개방", ru["unlocked"] and ru["attempt"] == target)
                fin = guess_all(gssrs, giver, hidden, wrong=False)
                check(f"  회차{target} 정답 → 문제 종료", fin.get("solved") and fin.get("problem_over"), str(fin))
                did_prog = True

            elif plan == "fullfail":
                # 3회차까지 전원 오답 → 미해결. 출제자 6점(=1+2+3), 정답자 0점.
                fr = None
                for a in range(1, 4):
                    sc = strong[a - 1]; used_clue[giver].add(sc)
                    ru = rpc(cur, "hw_submit_clue", tok[giver], sc)
                    check(f"  회차{a} 개방(≥95)", ru["unlocked"] and ru["attempt"] == a, str(ru))
                    fr = guess_all(gssrs, giver, hidden, wrong=True)
                    if a < 3:
                        check(f"  회차{a} 전원 오답 → 회차{a+1}",
                              (not fr.get("solved")) and fr.get("next_attempt") == a + 1, str(fr))
                    else:
                        check("  회차3 전원 오답 → 미해결 정산",
                              (not fr.get("solved")) and fr.get("problem_over"), str(fr))
                fin = fr
                did_fail = True

            else:  # solve1
                sc = strong[0]; used_clue[giver].add(sc)
                ru = rpc(cur, "hw_submit_clue", tok[giver], sc)
                check("  회차1 개방(≥95)", ru["unlocked"], str(ru))
                mid = rpc(cur, "hw_submit_guess", tok[gssrs[0]], hidden)
                check("  첫 추측 후 미정산", mid["all_guessed"] is False, str(mid))
                fin = rpc(cur, "hw_submit_guess", tok[gssrs[1]], "절대아닌단어ZZZ")
                check("  전원 추측 후 정산", fin["all_guessed"] and fin.get("problem_over"), str(fin))

            cur.execute("select hidden_word from public.hw_revealed_words(%s) where player_id=%s and round_no=%s",
                        (rid, giver, rnd))
            rvw = cur.fetchone()
            check("  정산 후 이 라운드 히든워드 공개", bool(rvw) and rvw[0] == hidden, f"{rvw}")
            check(f"  game_over={is_last} (마지막 문제에만)", bool(fin.get("game_over")) == is_last,
                  str(fin.get("game_over")))
            after = points(cur, rid)
            d_total = sum(after.values()) - sum(before.values())
            d_giver = after[str(giver)] - before[str(giver)]
            # 최종 배점(배율 없음): 정답자 각 +1, 출제자=(해결회차-1)*해결회차/2, 미해결 6점.
            ng = len(gssrs)
            exp_giver, exp_total = {
                "solve1":   (0, 1),        # 1회차 성공: 출제자 0, 정답자 1명
                "prog2":    (1, 1 + ng),   # 2회차 성공: 출제자 1, 정답자 전원
                "prog3":    (3, 3 + ng),   # 3회차 성공: 출제자 3, 정답자 전원
                "cap":      (1, 1 + ng),   # 1회차(힌트소진) 실패→2회차 성공
                "fullfail": (6, 6),        # 3회차까지 실패: 출제자 6
            }[plan]
            check(f"  출제자 점수 정확(+{d_giver}=+{exp_giver}, {plan})", d_giver == exp_giver)
            check(f"  총점 변동 정확(+{d_total}=+{exp_total}, {plan})", d_total == exp_total)

    print("\n=== 종료 상태 ===")
    st = state(cur, rid)
    check("phase=game_over", st["phase"] == "game_over", st["phase"])
    check("회차 재도전(progression) 경로 실행됨", did_prog)
    check("10힌트 상한 경로 실행됨", did_cap)
    check("미해결(출제자 6점) 경로 실행됨", did_fail)
    cur.execute("""select indexdef from pg_indexes where schemaname='public'
                   and tablename='hw_clues' and indexdef ilike '%unique%'""")
    check("§7 힌트 재사용 유니크 인덱스 존재", any("clue_word" in d[0] for d in cur.fetchall()))

    print("=== 정리 ===")
    cur.execute("delete from public.hw_rooms where id=%s", (rid,))
    cur.execute("select count(*) from public.hw_rooms where id=%s", (rid,))
    check("테스트 방 삭제됨", cur.fetchone()[0] == 0)
    cur.execute("select count(*) from public.hw_words")
    check("어휘 데이터 보존(104,595)", cur.fetchone()[0] == 104595)

print(f"\n{'='*48}\n결과: {len(PASS)} 통과 / {len(FAIL)} 실패")
if FAIL:
    print("실패:", FAIL)
    raise SystemExit(1)
print("✅ 전 항목 통과")
