/**
 * 벌칙 안내 — stitch_devil/_2 레퍼런스. 사이렌 + 벌칙 조건 + 연회색 확인 버튼.
 * 조건: 내가 선택한 출연자 2명이 모두 조기 탈락하면 벌칙 대상.
 * 구체적 발동 회차·내용·시점은 미확정. 미시청 결과 노출 금지.
 * ⚠️ 프론트 전용.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';

function Siren() {
  return (
    <Svg width={150} height={150} viewBox="0 0 150 150">
      <Circle cx="75" cy="78" r="60" fill="#FEE2E2" opacity={0.5} />
      {[-60, -40, -20, 0, 20, 40, 60].map((a, i) => {
        const rad = ((a - 90) * Math.PI) / 180;
        const x1 = 75 + 40 * Math.cos(rad), y1 = 78 + 40 * Math.sin(rad);
        const x2 = 75 + 52 * Math.cos(rad), y2 = 78 + 52 * Math.sin(rad);
        return <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#FCA5A5" strokeWidth={4} strokeLinecap="round" />;
      })}
      <Rect x="46" y="96" width="58" height="12" rx="6" fill="#1E293B" />
      <Path d="M52 98 a23 30 0 0 1 46 0 Z" fill="#EF4444" />
      <Path d="M52 98 a23 30 0 0 1 46 0 Z" fill="#DC2626" opacity={0.25} />
      <Path d="M75 66 l3 7 7 3 -7 3 -3 7 -3-7 -7-3 7-3 Z" fill="#fff" />
      <Ellipse cx="68" cy="74" rx="4" ry="7" fill="#fff" opacity={0.3} />
    </Svg>
  );
}

export default function PenaltyScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>벌칙 안내</Text>

      <View style={styles.center}>
        <Siren />
        <Text variant="h1" color={colors.light.devilInk} style={styles.heading}>
          내가 선택한 출연자 2명이{'\n'}모두 조기 탈락 시,{'\n'}벌칙이 부여됩니다!
        </Text>
        <Text variant="body" color={colors.light.devilSub} style={styles.desc}>
          예측한 2명의 출연자가 모두{'\n'}조기 탈락할 경우,{'\n'}해당 참여자에게 벌칙이 적용됩니다.
        </Text>

        <View style={styles.penaltyCard}>
          <Text variant="caption" color={colors.light.devilBlue} style={styles.penaltyKicker}>벌칙 내용</Text>
          <Text style={styles.penaltyEmoji}>✉️</Text>
          <Text variant="h2" color={colors.light.devilInk} style={styles.penaltyText}>각 멤버에게{'\n'}1장씩 편지 작성</Text>
        </View>
      </View>

      <Button label="확인" block color={colors.light.devilInk} onPress={() => router.back()} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginTop: space.section },
  heading: { textAlign: 'center', marginTop: space.xl, fontSize: 22, lineHeight: 32 },
  desc: { textAlign: 'center', marginTop: space.lg },
  penaltyCard: {
    marginTop: space.xl, backgroundColor: colors.light.devilBlueWash,
    borderRadius: radius.soft, padding: space.xl, alignSelf: 'stretch', alignItems: 'center',
  },
  penaltyKicker: { letterSpacing: 1, marginBottom: space.sm },
  penaltyEmoji: { fontSize: 36, lineHeight: 44 },
  penaltyText: { textAlign: 'center', marginTop: space.sm },
  cta: { marginTop: space.section, borderRadius: radius.pill, backgroundColor: colors.light.devilCellBg, borderColor: 'transparent' },
});
