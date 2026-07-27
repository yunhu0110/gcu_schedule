/**
 * Logo — GCU 브랜드 마크 (design/assets/gcu.svg). 원본 256×200(비율 1.28).
 */
import Gcu from '@/assets/gcu.svg';

const RATIO = 256 / 200;

export function Logo({ height = 20 }: { height?: number }) {
  return <Gcu width={height * RATIO} height={height} />;
}
