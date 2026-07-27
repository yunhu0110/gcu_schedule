/**
 * S1. 표지 (홈) — 이 앱의 핵심 화면. 지금은 데이터 연결 전 플레이스홀더 골격.
 * 실제 데이터(hosts/meetups/availabilities)는 M1에서 연결한다.
 */
import { StyleSheet, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, space } from '@/theme/tokens';
import { todayStr, volLabel } from '@/lib/date';

export default function CoverScreen() {
  return (
    <Screen scroll padded={false}>
      {/* 표지 (플레이스홀더): 실제로는 모임장 사진 흑백 + theme_color 오버레이 */}
      <View style={styles.cover}>
        <Text variant="mono" color={colors.light.paper} style={styles.vol}>
          VOL. {volLabel(todayStr())}
        </Text>
        <View style={styles.coverTitle}>
          <Text variant="h1" color={colors.light.paper}>
            이 달의 모임장
          </Text>
          <Text variant="display" color={colors.light.paper}>
            준비 중
          </Text>
        </View>
        <Text variant="body" color={colors.light.paper}>
          모임장이 표지를 꾸미면 여기에 한마디가 표시돼요.
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.section}>
          <SectionHeader label="NEXT MEETUP" />
          <Card>
            <Text variant="body" color={colors.light.textSecondary}>
              아직 잡힌 모임이 없어요. 달력에서 가능한 날을 모아 첫 모임을 제안해보세요.
            </Text>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader label="이 달 일정 입력" />
          <Card>
            <Text variant="body">아직 아무도 일정을 넣지 않았어요.</Text>
            <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
              첫 번째로 넣어볼까요?
            </Text>
            <Button label="내 일정 입력하기" style={{ marginTop: space.md }} />
          </Card>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.light.neon,
    paddingHorizontal: space.screen,
    paddingTop: space.section,
    paddingBottom: space.xl,
    gap: space.lg,
    minHeight: 320,
    justifyContent: 'space-between',
  },
  vol: {},
  coverTitle: { gap: space.xs },
  body: { paddingHorizontal: space.screen, paddingTop: space.xl },
  section: { marginBottom: space.section },
});
