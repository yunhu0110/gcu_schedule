// CSS import 타입 선언 (Expo SDK57 템플릿의 global.css / *.module.css 대응).
// 우리 앱은 CSS 대신 theme/tokens.ts + StyleSheet를 쓰지만, 템플릿 데모 파일이
// 남아있는 동안 tsc를 통과시키기 위한 최소 선언.
declare module '*.css';
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
