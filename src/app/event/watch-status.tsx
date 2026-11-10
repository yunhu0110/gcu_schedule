/**
 * 회차 시청 현황 — 각 회차별로 누가(닉네임) 언제(시각) '시청 완료 등록'했는지.
 * 시청 기록은 결과가 아니므로 전원 공개(스포일러 아님). (devil_watch_status RPC)
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { DetailHeader } from '@/components/DetailHeader';
import { colors, radius, space } from '@/theme/tokens';
import { formatDateTime } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { EPISODES } from '@/features/event/devilAssets';
import { listWatchStatus } from '@/api/devil';

export default function WatchStatusScreen() {
  const { userId } = useAuth();
  const { data: rows = [] } = useQuery({ queryKey: ['devil', 'watchStatus'], queryFn: listWatchStatus, enabled: !!userId });

  // 회차 → [{nickname, watched_at}] (시각순)
  const byEp = useMemo(() => {
    const m = new Map<number, { nickname: string; watched_at: string; mine: boolean }[]>();
    for (const r of rows) {
      const arr = m.get(r.episode) ?? [];
      arr.push({ nickname: r.nickname, watched_at: r.watched_at, mine: r.member_id === userId });
      m.set(r.episode, arr);
    }
    return m;
  }, [rows, userId]);

  return (
    <Screen scroll>
      <DetailHeader />
      <Text variant="h1" color={colors.light.devilInk}>회차 시청 현황</Text>
      <Text variant="bodySm" color={colors.light.devilSub} style={styles.sub}>
        회차마다 누가 언제 시청 완료를 등록했는지 볼 수 있어요.
      </Text>

      <View style={styles.list}>
        {EPISODES.map((ep) => {
          const people = byEp.get(ep) ?? [];
          return (
            <View key={ep} style={styles.card}>
              <View style={styles.cardHead}>
                <Text variant="bodyBold" color={colors.light.devilInk}>{ep}화</Text>
                <View style={styles.countPill}>
                  <Text variant="caption" color={colors.light.devilBlue}>{people.length}명 완료</Text>
                </View>
              </View>
              {people.length === 0 ? (
                <Text variant="bodySm" color={colors.light.devilSub} style={styles.empty}>아직 등록한 사람이 없어요.</Text>
              ) : (
                <View style={styles.people}>
                  {people.map((p, i) => (
                    <View key={i} style={styles.personRow}>
                      <Text variant="bodySm" color={p.mine ? colors.light.devilBlue : colors.light.devilInk}>
                        {p.mine ? `${p.nickname} (나)` : p.nickname}
                      </Text>
                      <Text variant="caption" color={colors.light.devilSub}>{formatDateTime(p.watched_at)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sub: { marginTop: space.xs },
  list: { gap: space.md, marginTop: space.xl },
  card: { backgroundColor: colors.light.devilCellBg, borderRadius: radius.soft, padding: space.lg },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countPill: { backgroundColor: colors.light.devilBlueWash, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 3 },
  empty: { marginTop: space.sm },
  people: { marginTop: space.md, gap: space.sm },
  personRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
