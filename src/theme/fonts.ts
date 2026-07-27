/**
 * 폰트 로드 맵 — expo-font useFonts에 넘긴다. 키는 tokens.fonts의 값과 일치.
 * Wanted Sans/Pretendard 라이선스 파일 번들 전까지 Google 폰트로 스탠드인(ADR-008).
 */
import { BigShouldersDisplay_900Black } from '@expo-google-fonts/big-shoulders-display';
import { IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { NotoSerifKR_900Black } from '@expo-google-fonts/noto-serif-kr';
import {
  NotoSansKR_400Regular,
  NotoSansKR_700Bold,
  NotoSansKR_900Black,
} from '@expo-google-fonts/noto-sans-kr';

export const fontMap = {
  NotoSansKR_400Regular,
  NotoSansKR_700Bold,
  NotoSansKR_900Black,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  BigShouldersDisplay_900Black,
  NotoSerifKR_900Black,
};
