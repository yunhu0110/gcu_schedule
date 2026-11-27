/**
 * 대기실 — design/stitch_word_design/_4. 실시간 참가자 목록 + 준비 토글 + QR/코드 + 게임시작(방장).
 * 참가자 입퇴장/준비상태는 Supabase Realtime으로 즉시 반영.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import { fetchPlayers, fetchRoom, setReady, subscribeRoom, type Player, type Room } from '../lib/rooms';
import { startGame, parseGameState } from '../lib/game';
import { getSession } from '../lib/session';
import './LobbyScreen.css';

export default function LobbyScreen() {
  const nav = useNavigate();
  const { code = '' } = useParams();
  const session = useMemo(() => getSession(code), [code]);
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const r = await fetchRoom(code);
    if (!r) { setRoom(null); setLoading(false); return; }
    setRoom(r);
    setPlayers(await fetchPlayers(r.id));
    setLoading(false);
    const gs = parseGameState(r.state);
    if (gs?.phase === 'envelope_selection') { nav(`/room/${code}/envelopes`); return; }
    if (gs?.phase === 'hidden_word_selection') { nav(`/room/${code}/hidden`); return; }
    if (gs?.phase === 'round' || gs?.phase === 'game_over') { nav(`/room/${code}/play`); return; }
  }, [code, nav]);

  useEffect(() => {
    if (!session) { nav(`/join/${code}`, { replace: true }); return; }
    let unsub = () => {};
    reload().then(() => {
      fetchRoom(code).then((r) => {
        if (!r) return;
        unsub = subscribeRoom(r.id, reload);
      });
    });
    return () => unsub();
  }, [code, reload, nav, session]);

  const me = players.find((p) => p.id === session?.playerId);
  const allReady = players.length >= 2 && players.every((p) => p.is_ready || p.is_host);
  // HashRouter 사용 — 입장 경로는 해시(#) 뒤에 둔다. BASE_URL은 배포 서브경로(/.../hidden-word/).
  const joinUrl = `${window.location.origin}${import.meta.env.BASE_URL}#/join/${code}`;
  const [starting, setStarting] = useState(false);
  const [rounds, setRounds] = useState(1); // 라운드(바퀴) 수. 방장이 자유롭게 설정(상한 없음). 봉투는 라운드마다 새로 생성
  const [shared, setShared] = useState(false);

  const clampRounds = (n: number) => Math.max(1, n);

  async function handleShare() {
    const text = `히든 워드 같이 해요! 방 코드 ${room?.code ?? code}`;
    try {
      if (navigator.share) { await navigator.share({ title: '히든 워드', text, url: joinUrl }); return; }
    } catch { /* 사용자가 공유 취소 — 무시 */ }
    try {
      await navigator.clipboard.writeText(joinUrl);
      setShared(true);
      setTimeout(() => setShared(false), 1800);
    } catch { alert(joinUrl); }
  }

  async function toggleReady() {
    if (!session || !me) return;
    try { await setReady(session.token, !me.is_ready); } catch (e) { alert(e instanceof Error ? e.message : '오류'); }
  }

  async function handleStartGame() {
    if (!session || !allReady || starting) return;
    setStarting(true);
    try { await startGame(session.token, clampRounds(rounds)); }
    catch (e) { alert(e instanceof Error ? e.message : '게임 시작 실패'); }
    finally { setStarting(false); }
  }

  if (loading) return <div className="screen"><ScreenHeader title="대기실" /></div>;
  if (!room) return (
    <div className="screen"><ScreenHeader title="대기실" onBack={() => nav('/')} />
      <p className="muted" style={{ textAlign: 'center', marginTop: 40 }}>방을 찾을 수 없어요.</p>
    </div>
  );

  return (
    <div className="screen lobby">
      <ScreenHeader title="대기실" onBack={() => nav('/')} />
      <p className="muted lobby__sub">모든 참가자가 준비되면 게임이 시작됩니다</p>

      <div className="lobby__invite panel">
        <div className="lobby__qr"><QRCodeSVG value={joinUrl} size={92} bgColor="transparent" fgColor="#e6dfd3" /></div>
        <div className="lobby__code">
          <span className="kicker">방 코드</span>
          <div className="lobby__code-val mono">{room.code}</div>
          <span className="muted lobby__count">{players.length} / {room.max_players}명</span>
          <button className="btn lobby__share" onClick={handleShare}>
            {shared ? '링크 복사됨 ✓' : '초대 링크 공유'}
          </button>
        </div>
      </div>

      <div className="lobby__list">
        <AnimatePresence initial={false}>
          {players.map((p) => (
            <motion.div
              key={p.id}
              layout
              className={`lobby__row panel${p.id === session?.playerId ? ' is-me' : ''}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className="lobby__gem" style={{ ['--gem' as string]: p.color }} />
              <span className="lobby__name">
                {p.nickname}{p.is_host && <span className="lobby__host"> ♛ 방장</span>}
              </span>
              <span className={`lobby__status${p.is_ready || p.is_host ? ' is-ready' : ''}`}>
                {p.is_host ? '방장' : p.is_ready ? '● 준비완료' : '○ 대기중'}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {me?.is_host && (
        <div className="lobby__rounds panel">
          <span className="kicker">라운드 수</span>
          <div className="lobby__rounds-ctrl">
            <button
              className="lobby__rounds-btn"
              onClick={() => setRounds((n) => clampRounds(n - 1))}
              disabled={rounds <= 1}
              aria-label="라운드 줄이기"
            >−</button>
            <span className="lobby__rounds-val mono">{rounds}</span>
            <button
              className="lobby__rounds-btn"
              onClick={() => setRounds((n) => clampRounds(n + 1))}
              aria-label="라운드 늘리기"
            >+</button>
          </div>
          <span className="muted lobby__rounds-hint">1라운드 = 전원이 각자 1번씩 출제 (총 {rounds * players.length}문제)</span>
        </div>
      )}

      <div className="lobby__footer">
        <span className="muted lobby__ready-count">
          {players.filter((p) => p.is_ready || p.is_host).length} / {players.length}명 준비 완료
        </span>
        {me && !me.is_host && (
          <button className={`btn${me.is_ready ? '' : ' btn--primary'}`} onClick={toggleReady}>
            {me.is_ready ? '준비 취소' : '준비 완료'}
          </button>
        )}
        {me?.is_host && (
          <button
            className="btn btn--primary"
            disabled={!allReady || starting}
            onClick={handleStartGame}
          >
            {starting ? '시작 중…' : '게임 시작'}
          </button>
        )}
      </div>
    </div>
  );
}
