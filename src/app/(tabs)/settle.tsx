/**
 * S7. 정산 — M3에서 구현. 지금은 자리만.
 */
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import { colors } from '@/theme/tokens';

export default function SettleScreen() {
  return (
    <Screen scroll>
      <Text variant="h1">정산</Text>
      <SectionHeader label="진행 중 정산" />
      <Card>
        <Text variant="body" color={colors.light.textSecondary}>
          모임별 회비 정산이 여기에 표시됩니다. 정산은 M3에서 열려요.
        </Text>
      </Card>
    </Screen>
  );
}
