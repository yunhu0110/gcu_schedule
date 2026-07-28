/**
 * TabIcon — 하단 탭용 라인 아이콘(react-native-svg 직접 드로잉). 아이콘 폰트 의존 없음.
 * 홈 · 달력 · 기록 · 마이페이지. color는 탭 활성/비활성 tint가 주입된다.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'calendar' | 'record' | 'profile' | 'bell';

type Props = { name: TabIconName; color: string; size?: number };

export function TabIcon({ name, color, size = 24 }: Props) {
  const common = {
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none' as const,
  };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...common} />
          <Path d="M5.5 9.5V20h13V9.5" {...common} />
          <Path d="M9.5 20v-5h5v5" {...common} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x="3.5" y="5" width="17" height="15" rx="2.5" {...common} />
          <Path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" {...common} />
          <Circle cx="8.5" cy="13.5" r="1" fill={color} />
          <Circle cx="12" cy="13.5" r="1" fill={color} />
          <Circle cx="15.5" cy="13.5" r="1" fill={color} />
        </>
      )}
      {name === 'record' && (
        <>
          <Path d="M6 3.5h8l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" {...common} />
          <Path d="M13.5 3.5V8h4.5M8.5 12.5h7M8.5 16h7" {...common} />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx="12" cy="8.5" r="3.5" {...common} />
          <Path d="M5.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" {...common} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 3 .8 4.5 1.5 5.3.4.4.1 1.2-.5 1.2H5.5c-.6 0-.9-.8-.5-1.2.7-.8 1.5-2.3 1.5-5.3Z" {...common} />
          <Path d="M10 19.5a2 2 0 0 0 4 0" {...common} />
        </>
      )}
    </Svg>
  );
}
