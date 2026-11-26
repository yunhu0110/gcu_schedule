/**
 * ScreenHeader — 뒤로가기(‹) + 중앙 제목(한글 세리프). 시안 공통 상단.
 */
import { useNavigate } from 'react-router-dom';

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const nav = useNavigate();
  return (
    <div className="scr-header">
      <button className="scr-header__back" onClick={() => (onBack ? onBack() : nav(-1))} aria-label="뒤로">‹</button>
      <h2 className="scr-header__title">{title}</h2>
      <span className="scr-header__spacer" />
    </div>
  );
}
