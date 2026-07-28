/**
 * gcu.svg → 앱 아이콘/로고 PNG 생성 (일회성 도구, 앱 런타임 의존 아님).
 *   node scripts/gen-icons.js
 * 산출:
 *   assets/images/icon.png                 앱 아이콘(1024, 흰 배경)
 *   assets/images/android-icon-foreground.png  안드로이드 어댑티브 전경(1024, 투명)
 *   assets/images/logo.png                 인앱 헤더 로고(투명, 타이트) — react-native-svg가
 *                                          이 SVG(clipPath+translate)를 못 그려서 PNG로 사용
 *   assets/images/splash-icon.png          스플래시용 로고(투명)
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
// 앱 아이콘/로고 원본은 design/assets/gcu.svg (브랜드 마크의 단일 출처).
const raw = fs.readFileSync(path.join(ROOT, 'design/assets/gcu.svg'), 'utf8');

// 원본 <svg ...>INNER</svg> 에서 INNER(defs + 그룹)만 추출 → viewBox 0 0 256 200 좌표계.
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// 1024 캔버스에 로고를 중앙 배치(아이콘용). bg=null이면 투명.
function iconCanvas({ bg, logoW }) {
  const logoH = Math.round((logoW * 200) / 256);
  const x = Math.round((1024 - logoW) / 2);
  const y = Math.round((1024 - logoH) / 2);
  const rect = bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : '';
  return `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">${rect}<svg x="${x}" y="${y}" width="${logoW}" height="${logoH}" viewBox="0 0 256 200">${inner}</svg></svg>`;
}

// 로고만 타이트하게(헤더/스플래시용, 투명 배경). 원본 비율 256:200 유지.
function logoOnly(w) {
  const h = Math.round((w * 200) / 256);
  return `<svg width="${w}" height="${h}" viewBox="0 0 256 200" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function render(svg, out, width) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
  fs.writeFileSync(path.join(ROOT, out), png);
  console.log('wrote', out);
}

render(iconCanvas({ bg: '#FFFFFF', logoW: 600 }), 'assets/images/icon.png', 1024);
render(iconCanvas({ bg: null, logoW: 520 }), 'assets/images/android-icon-foreground.png', 1024);
render(logoOnly(512), 'assets/images/logo.png', 512);
render(logoOnly(600), 'assets/images/splash-icon.png', 600);
