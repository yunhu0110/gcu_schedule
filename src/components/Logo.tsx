/**
 * Logo — GCU 브랜드 마크. 원본 gcu.svg는 clipPath+translate 구조라 react-native-svg가
 * 렌더하지 못해(빈 화면) PNG(assets/images/logo.png, resvg로 생성)를 Image로 쓴다.
 * 원본 비율 256×200(1.28).
 */
import { Image } from 'react-native';

const RATIO = 256 / 200;
const SRC = require('../../assets/images/logo.png');

export function Logo({ height = 20 }: { height?: number }) {
  return <Image source={SRC} style={{ width: height * RATIO, height }} resizeMode="contain" />;
}
