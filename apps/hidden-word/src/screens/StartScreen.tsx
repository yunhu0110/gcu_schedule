/**
 * 시작 화면 — design/stitch_word_design/hidden_word 기준.
 * 보석 로고 + HIDDEN WORD / MAIN MATCH + 태그라인 + 게임시작/방코드/QR 버튼.
 */
import { useNavigate } from 'react-router-dom';
import { GemLogo } from '../components/GemLogo';
import './StartScreen.css';

export default function StartScreen() {
  const nav = useNavigate();
  return (
    <div className="screen start">
      <div className="start__top">
        <div className="start__logo">
          <GemLogo size={92} />
        </div>
        <h1 className="start__title">HIDDEN<br />WORD</h1>
        <div className="start__rule-line">
          <span />＊ MAIN MATCH ＊<span />
        </div>
        <p className="start__tagline">단어의 힌트로,<br />정답을 찾아라</p>
      </div>

      <div className="start__actions">
        <button className="btn btn--primary" onClick={() => nav('/create')}>게임 시작</button>
        <div className="start__row">
          <button className="btn btn--ghost" onClick={() => nav('/join')}>방 코드 입력</button>
          <button className="btn btn--ghost" onClick={() => nav('/join')}>QR로 입장</button>
        </div>
        <button className="start__link" onClick={() => nav('/how-to-play')}>게임 설명 보기</button>
      </div>
    </div>
  );
}
