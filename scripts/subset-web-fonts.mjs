/**
 * 웹(PWA)용 폰트 서브셋 생성기.
 *
 * 왜 필요한가: 네이티브는 폰트를 앱에 번들해 두지만, 웹은 첫 방문에 네트워크로 받는다.
 * 원본 TTF를 그대로 쓰면 한글 폰트만 32MB라 모바일 회선에서 사실상 못 쓴다.
 * 한자·미사용 글리프를 걷어내고 woff2로 압축하면 수십분의 1로 줄어든다.
 *
 * 실행: node scripts/subset-web-fonts.mjs
 * 출력: public/fonts/*.woff2  (Expo가 web export 시 dist 루트로 복사)
 *
 * 패밀리명은 네이티브와 동일하게 유지한다 → tokens.ts / type 프리셋을 건드릴 필요가 없다.
 * 서브셋에 없는 희귀 글자는 tofu가 아니라 기기 기본 한글 폰트로 대체되어 렌더된다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import subsetFont from 'subset-font';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'fonts');

/** 코드포인트 범위(양끝 포함)를 문자열로 편다. */
function range(from, to) {
  let s = '';
  for (let cp = from; cp <= to; cp++) s += String.fromCodePoint(cp);
  return s;
}

/** 라틴 문자·숫자·기호 — 모든 폰트에 공통으로 넣는다. */
const LATIN =
  range(0x20, 0x7e) + // ASCII 출력 가능 문자
  range(0xa0, 0xff) + // 라틴-1 보충 (é, ü 등)
  '‘’“”…·–—→←↑↓°※★☆♥✓' + // 본문에서 실제로 쓰는 약물
  '₩€$¥'; // 통화 (정산 화면)

/** 한글 — 완성형 음절 전체 + 자모 + 한국어 문서에서 흔한 전각/CJK 문장부호. */
const HANGUL =
  range(0xac00, 0xd7a3) + // 완성형 음절 11,172자
  range(0x3131, 0x318e) + // 호환 자모 (ㄱ, ㅏ … "ㅋㅋ" 같은 표기)
  range(0x3000, 0x303f) + // CJK 문장부호 (「」『』〈〉 등)
  range(0xff01, 0xff5e); // 전각 영숫자·기호

const JOBS = [
  // 한글이 필요한 폰트
  { file: 'fonts/Jalnan2/Jalnan2TTF.ttf', family: 'Jalnan2', chars: LATIN + HANGUL },
  { file: 'fonts/JalnanGothic/JalnanGothicTTF.ttf', family: 'JalnanGothic', chars: LATIN + HANGUL },
  {
    file: 'node_modules/@expo-google-fonts/noto-sans-kr/400Regular/NotoSansKR_400Regular.ttf',
    family: 'NotoSansKR_400Regular',
    chars: LATIN + HANGUL,
  },
  {
    file: 'node_modules/@expo-google-fonts/noto-sans-kr/700Bold/NotoSansKR_700Bold.ttf',
    family: 'NotoSansKR_700Bold',
    chars: LATIN + HANGUL,
  },
  {
    file: 'node_modules/@expo-google-fonts/noto-serif-kr/900Black/NotoSerifKR_900Black.ttf',
    family: 'NotoSerifKR_900Black',
    chars: LATIN + HANGUL,
  },
  // 라틴 전용 (숫자·영문 라벨에만 쓰임)
  {
    file: 'node_modules/@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf',
    family: 'IBMPlexMono_500Medium',
    chars: LATIN,
  },
  {
    file: 'node_modules/@expo-google-fonts/ibm-plex-mono/600SemiBold/IBMPlexMono_600SemiBold.ttf',
    family: 'IBMPlexMono_600SemiBold',
    chars: LATIN,
  },
  {
    file: 'node_modules/@expo-google-fonts/big-shoulders-display/BigShouldersDisplay_900Black.ttf',
    family: 'BigShouldersDisplay_900Black',
    chars: LATIN,
  },
];

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  let originalTotal = 0;
  let subsetTotal = 0;

  for (const job of JOBS) {
    const src = path.join(ROOT, job.file);
    const original = await readFile(src);
    const subset = await subsetFont(original, job.chars, { targetFormat: 'woff2' });
    await writeFile(path.join(OUT_DIR, `${job.family}.woff2`), subset);

    originalTotal += original.length;
    subsetTotal += subset.length;
    const pct = ((1 - subset.length / original.length) * 100).toFixed(1);
    console.log(`  ${job.family.padEnd(30)} ${kb(original.length).padStart(7)} → ${kb(subset.length).padStart(7)}  (-${pct}%)`);
  }

  console.log(
    `\n총합 ${kb(originalTotal)} → ${kb(subsetTotal)} ` +
      `(-${((1 - subsetTotal / originalTotal) * 100).toFixed(1)}%)`,
  );
}

main().catch((err) => {
  console.error('폰트 서브셋 실패:', err);
  process.exit(1);
});
