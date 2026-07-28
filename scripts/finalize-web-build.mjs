/**
 * web export 후처리 — PWA 메타태그 주입 + GitHub Pages용 파일 배치.
 *
 * 왜 후처리인가: expo-router의 `+html.tsx`는 정적 렌더링(output: "static") 전용이라
 * 이 앱의 SPA 출력(output: "single")에서는 무시된다. 그래서 생성된 index.html에 직접 넣는다.
 *
 * 실행: node scripts/finalize-web-build.mjs   (expo export -p web 다음에)
 * 하는 일:
 *   1) index.html에 PWA/iOS 메타태그와 모바일 웹용 CSS 리셋 주입
 *   2) 404.html = index.html 복사 → SPA 딥링크·새로고침이 GitHub Pages에서 404 나지 않게
 *   3) .nojekyll 생성 → Pages가 _expo 같은 밑줄 시작 디렉터리를 무시하지 않게 (필수)
 */
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const INDEX = path.join(DIST, 'index.html');

/** baseUrl은 app.json이 단일 출처. 여기서 다시 하드코딩하지 않는다. */
async function readBaseUrl() {
  const appJson = JSON.parse(await readFile(path.join(ROOT, 'app.json'), 'utf8'));
  return (appJson.expo?.experiments?.baseUrl ?? '').replace(/\/$/, '');
}

const HEAD_TAGS = (base) => `
    <meta name="description" content="6인 소모임 위키 + 일정 조율" />
    <meta name="theme-color" content="#FFFFFF" />

    <link rel="manifest" href="${base}/manifest.json" />

    <!-- iOS 사파리는 manifest의 display/아이콘을 온전히 따르지 않아 전용 태그가 따로 필요하다 -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="월간gcu" />
    <link rel="apple-touch-icon" href="${base}/icons/apple-touch-icon.png" />

    <style id="moim-web-reset">
      /* 사파리 고무줄 스크롤 제거 — PWA에서 특히 티가 난다 */
      html, body { overscroll-behavior: none; -webkit-text-size-adjust: 100%; }
      body { -webkit-tap-highlight-color: transparent; }
      /* 입력창 글자가 16px 미만이면 iOS가 포커스 시 화면을 확대해버린다 */
      input, textarea, select { font-size: 16px; }
    </style>
`;

/** viewport-fit=cover: 노치/홈 인디케이터 영역까지 그리고 여백은 safe-area-inset으로 처리 */
const VIEWPORT =
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />';

async function main() {
  const base = await readBaseUrl();
  let html = await readFile(INDEX, 'utf8');

  if (html.includes('moim-web-reset')) {
    console.log('이미 후처리된 index.html — 건너뜀');
  } else {
    html = html.replace('<html lang="en">', '<html lang="ko">');

    const viewportRe = /<meta name="viewport"[^>]*\/?>/;
    if (!viewportRe.test(html)) throw new Error('index.html에서 viewport 메타태그를 찾지 못했습니다.');
    html = html.replace(viewportRe, VIEWPORT);

    if (!html.includes('</head>')) throw new Error('index.html에서 </head>를 찾지 못했습니다.');
    html = html.replace('</head>', `${HEAD_TAGS(base)}  </head>`);

    await writeFile(INDEX, html);
    console.log('✓ index.html에 PWA 메타태그 주입');
  }

  // SPA 딥링크 폴백: /gcu_schedule/calendar 새로고침 시 Pages가 404.html을 주고, 그 안의 앱이 라우팅한다.
  await copyFile(INDEX, path.join(DIST, '404.html'));
  console.log('✓ 404.html 생성 (SPA 폴백)');

  // Pages의 Jekyll 처리는 _로 시작하는 경로를 무시한다 → _expo 번들이 통째로 사라진다.
  await writeFile(path.join(DIST, '.nojekyll'), '');
  console.log('✓ .nojekyll 생성');
}

main().catch((err) => {
  console.error('web 빌드 후처리 실패:', err);
  process.exit(1);
});
