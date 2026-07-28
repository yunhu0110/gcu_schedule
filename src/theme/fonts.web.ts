/**
 * 폰트 로드 (웹) — fonts.ts의 웹 대응본.
 *
 * 네이티브는 expo-font가 TTF를 번들에서 읽지만, 웹은 원본 TTF를 그대로 받으면 32MB다.
 * 그래서 웹은 서브셋 woff2(총 ~2.5MB)를 @font-face로 직접 등록한다.
 *   - 생성: `node scripts/subset-web-fonts.mjs` → public/fonts/*.woff2
 *   - 패밀리명은 네이티브와 동일 → tokens.ts의 fonts/type 프리셋을 그대로 쓴다.
 *
 * fontMap을 비워 두는 이유: useFonts({})는 즉시 로드 완료로 떨어져 스플래시가 붙잡히지 않는다.
 * 폰트는 font-display: swap으로 준비되는 대로 교체된다 — 흰 화면을 오래 보여주는 것보다 낫다.
 */

/** GitHub Pages 하위경로(/gcu_schedule) 배포 대응. Expo가 빌드 시 주입한다. */
const BASE = (process.env.EXPO_BASE_URL ?? '').replace(/\/$/, '');

const FAMILIES = [
  'Jalnan2',
  'JalnanGothic',
  'NotoSansKR_400Regular',
  'NotoSansKR_700Bold',
  'NotoSerifKR_900Black',
  'IBMPlexMono_500Medium',
  'IBMPlexMono_600SemiBold',
  'BigShouldersDisplay_900Black',
] as const;

const STYLE_ID = 'moim-web-fonts';

function injectFontFaces() {
  if (typeof document === 'undefined') return; // SSR/프리렌더 방어
  if (document.getElementById(STYLE_ID)) return; // 중복 주입 방지 (HMR)

  const css = FAMILIES.map(
    (family) => `@font-face {
  font-family: '${family}';
  src: url('${BASE}/fonts/${family}.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}`,
  ).join('\n');

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);

  // 본문 폰트는 거의 모든 화면에서 즉시 필요하므로 먼저 받아둔다.
  const preload = document.createElement('link');
  preload.rel = 'preload';
  preload.as = 'font';
  preload.type = 'font/woff2';
  preload.crossOrigin = 'anonymous';
  preload.href = `${BASE}/fonts/NotoSansKR_400Regular.woff2`;
  document.head.appendChild(preload);
}

injectFontFaces();

/** useFonts에 넘길 맵 — 웹은 @font-face로 이미 등록했으므로 비어 있다. */
export const fontMap = {};
