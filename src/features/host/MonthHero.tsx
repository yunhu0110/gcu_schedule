/**
 * MonthHero — 홈의 "모임 날짜" 히어로 카드 한 장(= 한 달).
 * 홈에서 좌우로 넘기며 지난 달·다음 달 모임 일자를 보고 고칠 수 있게 페이지 단위로 쓴다.
 * 어느 달을 다루는지는 부모가 넘긴 month 하나로 정해진다(버튼 콜백도 그 달로 묶어서 넘긴다).
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, fonts, radius, space } from '@/theme/tokens';
import { dday, formatKo, volLabel, type DateStr } from '@/lib/date';

type Props = {
  month: DateStr; // 그 달의 아무 날짜(라벨·연월 계산용)
  width: number;
  confirmed: DateStr | null;
  canFix: boolean; // 그 달 담당자/관리자만 날짜 확정·변경
  onOpenCalendar: () => void;
  onEditDate: () => void;
};

export function MonthHero({ month, width, confirmed, canFix, onOpenCalendar, onEditDate }: Props) {
  const m = Number(month.slice(5, 7));
  const left = confirmed ? dday(confirmed) : null;
  const label = left == null ? '미정' : left > 0 ? `D-${left}` : left === 0 ? 'D-DAY' : `D+${-left}`;

  return (
    <View style={[styles.hero, { width }]}>
      <View style={styles.heroDeco} />
      <View style={styles.heroTop}>
        <View style={styles.chip}>
          <Text variant="kicker" color={colors.light.paper}>◆ {m}월 모임</Text>
        </View>
        <Text variant="mono" color={colors.light.paper60}>{volLabel(month)}</Text>
      </View>
      <Text style={styles.heroBig}>{label}</Text>
      <Text variant="body" color={colors.light.paper} style={{ marginTop: space.xs }}>
        {confirmed ? `${formatKo(confirmed)} 모임` : `${m}월 모임 날짜 미정`}
      </Text>
      <Button label="달력에서 내 일정 입력" block onPress={onOpenCalendar} style={{ marginTop: space.lg }} />
      {canFix ? (
        <Button label={confirmed ? '날짜 변경' : '날짜 확정하기'} variant="ghost" block onPress={onEditDate} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.light.heroBg, borderRadius: radius.hero, padding: 22, overflow: 'hidden' },
  heroDeco: { position: 'absolute', right: -30, top: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: colors.light.cobalt22 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { backgroundColor: colors.light.cobalt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 10 },
  heroBig: { fontFamily: fonts.display, fontSize: 44, lineHeight: 54, letterSpacing: -1, color: colors.light.paper, marginTop: space.md },
});
