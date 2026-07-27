// 로컬 폰트 asset require 타입 선언 (Metro가 런타임에 처리, tsc용).
declare module '*.ttf';
declare module '*.otf';

// SVG를 컴포넌트로 import (react-native-svg-transformer).
declare module '*.svg' {
  import type { FC } from 'react';
  import type { SvgProps } from 'react-native-svg';
  const content: FC<SvgProps>;
  export default content;
}
