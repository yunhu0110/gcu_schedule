/**
 * S4. 위키 목록 — M2에서 구현. 지금은 자리만.
 */
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, space } from '@/theme/tokens';

export default function WikiScreen() {
  return (
    <Screen scroll>
      <Text variant="h1">기록</Text>
      <SectionHeader label="RECENT PAGES" />
      <Card>
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          모임 기록이 여기에 쌓입니다. 위키는 M2에서 열려요.
        </Text>
      </Card>
    </Screen>
  );
}
