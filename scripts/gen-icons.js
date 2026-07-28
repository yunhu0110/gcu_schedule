/**
 * gcu.svg → 앱 아이콘 PNG 생성 (일회성 도구, 앱 런타임 의존 아님).
 *   node scripts/gen-icons.js
 * 산출: assets/images/icon.png(1024, 흰 배경) · android-icon-foreground.png(1024, 투명, 어댑티브 세이프존)
 */
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
// 앱 아이콘 원본은 design/assets/gcu.svg (브랜드 마크의 단일 출처).
const raw = fs.readFileSync(path.join(ROOT, 'design/assets/gcu.svg'), 'utf8');

// 원본 <svg ...>INNER</svg> 에서 INNER(defs + 그룹)만 추출 → viewBox 0 0 256 200 좌표계.
const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

function compose({ bg, logoW }) {
  const logoH = Math.round((logoW * 200) / 256);
  const x = Math.round((1024 - logoW) / 2);
  const y = Math.round((1024 - logoH) / 2);
  const rect = bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : '';
  return `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">${rect}<svg x="${x}" y="${y}" width="${logoW}" height="${logoH}" viewBox="0 0 256 200">${inner}</svg></svg>`;
}

function render(svg, out) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1024 } }).render().asPng();
  fs.writeFileSync(path.join(ROOT, out), png);
  console.log('wrote', out);
}

// 앱 아이콘: 흰 배경 + 로고(약 58%)
render(compose({ bg: '#FFFFFF', logoW: 600 }), 'assets/images/icon.png');
// 안드로이드 어댑티브 전경: 투명 + 로고(세이프존 고려 약 50%)
render(compose({ bg: null, logoW: 520 }), 'assets/images/android-icon-foreground.png');
