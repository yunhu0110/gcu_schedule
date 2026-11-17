/**
 * alertShim — 웹(react-native-web)에서 Alert.alert는 no-op(아무 동작 안 함)이라
 * 확인/안내 팝업에 막힌 모든 동작(탈락자 등록, 결과 조회 확인 등)이 침묵 실패한다.
 * → 웹에서만 Alert.alert를 window.confirm/alert로 동작하도록 덮어쓴다(모든 호출부 그대로).
 * 네이티브에서는 건드리지 않는다.
 *
 * 루트 레이아웃 최상단에서 side-effect import 한다.
 */
import { Alert, Platform } from 'react-native';

type Btn = { text?: string; onPress?: (value?: string) => void; style?: 'default' | 'cancel' | 'destructive' };

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // react-native-web의 Alert.alert(= () => {})를 덮어쓴다.
  (Alert as unknown as { alert: (t?: string, m?: string, b?: Btn[]) => void }).alert = (
    title,
    message,
    buttons,
  ) => {
    const msg = [title, message].filter(Boolean).join('\n\n');
    // 버튼이 없거나 1개뿐이면 단순 안내
    if (!buttons || buttons.length <= 1) {
      window.alert(msg);
      buttons?.[0]?.onPress?.();
      return;
    }
    // 2개 이상이면 확인/취소로 매핑(window.confirm은 OK/Cancel 2지선다)
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    const confirmBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    const ok = window.confirm(msg);
    if (ok) confirmBtn?.onPress?.();
    else cancelBtn?.onPress?.();
  };
}
