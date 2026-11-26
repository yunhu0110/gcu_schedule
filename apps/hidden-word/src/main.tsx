import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles/global.css';

// GitHub Pages 하위 경로 배포에서 딥링크(QR 입장) 새로고침이 404로 깨지지 않도록 HashRouter 사용.
// 경로는 해시(#) 뒤에 들어가 서버로 전송되지 않으므로 별도 404 폴백이 필요 없다.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
);
