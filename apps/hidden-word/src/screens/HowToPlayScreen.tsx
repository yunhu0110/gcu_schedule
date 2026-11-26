/**
 * 게임 설명 — 지시서 9-2의 핵심 규칙 8가지. 게임 도중에도 다시 확인 가능(공용 라우트).
 */
import { ScreenHeader } from '../components/ScreenHeader';
import '../components/ScreenHeader.css';
import './HowToPlayScreen.css';

const RULES: { n: number; text: string }[] = [
  { n: 1, text: '봉투 6개 중 하나를 선택한다.' },
  { n: 2, text: '봉투 안의 단어 5개 중 하나를 히든 워드로 정한다. (본인만 알 수 있음)' },
  { n: 3, text: '출제자는 히든 워드와 관련된 명사형 힌트를 제출한다.' },
  { n: 4, text: '한 차수는 최대 10개 힌트, 제한시간 15분.' },
  { n: 5, text: '유사도 95% 이상이면 힌트 제출이 즉시 종료된다. (정답 처리 아님)' },
  { n: 6, text: '나머지 참가자는 5분 안에 정답을 제출한다.' },
  { n: 7, text: '정답자는 1점. 아무도 못 맞히면 출제자는 최종 실패 차수에 따라 1~3점.' },
  { n: 8, text: '2라운드는 남은 4개 단어 중 하나를 선택하며 점수는 2배.' },
];

export default function HowToPlayScreen() {
  return (
    <div className="screen">
      <ScreenHeader title="게임 설명" />
      <p className="kicker" style={{ textAlign: 'center', marginBottom: 18 }}>HOW TO PLAY</p>
      <ol className="htp-list">
        {RULES.map((r) => (
          <li key={r.n} className="htp-item panel">
            <span className="htp-num">{String(r.n).padStart(2, '0')}</span>
            <span className="htp-text">{r.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
