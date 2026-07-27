/**
 * 폰트 로드 맵 — expo-font useFonts에 넘긴다. 키는 tokens.fonts의 값과 일치.
 * 브랜드/제목: Jalnan2 · JalnanGothic (로컬 번들, 여기어때 잘난체) — 하이에너지(ADR-008).
 * 본문/숫자/감성: Noto Sans KR · IBM Plex Mono · Big Shoulders Display · Noto Serif KR (Google).
 */
import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { NotoSerifKR_900Black } from '@expo-google-fonts/noto-serif-kr';
import { NotoSansKR_400Regular, NotoSansKR_700Bold } from '@expo-google-fonts/noto-sans-kr';

export const fontMap = {
  // 로컬 번들 (fonts/ 디렉토리)
  Jalnan2: require('../../fonts/Jalnan2/Jalnan2TTF.ttf'),
  JalnanGothic: require('../../fonts/JalnanGothic/JalnanGothicTTF.ttf'),
  // Google 폰트
  NotoSansKR_400Regular,
  NotoSansKR_700Bold,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  BigShouldersDisplay_900Black,
  NotoSerifKR_900Black,
};
