/**
 * S4. 기록 — 누구나 표지(사진/동영상 + 글)를 올리고 월별로 정리해 보여준다.
 * "기록하기"로 이번 달 기록 작성. 표지를 누르면 상세 + 코멘트.
 */
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { CoverEditModal, type CoverSubmit } from '@/features/host/CoverEditModal';
import { colors, radius, space } from '@/theme/tokens';
import { formatKo } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { createRecord, listRecords, uploadRecordImage, uploadRecordVideo, type Record } from '@/api/records';

export default function RecordScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);

  const { data: records = [] } = useQuery({ queryKey: ['records'], queryFn: listRecords, enabled: !!userId });

  // 월별 그룹핑 (records는 이미 최근 월 → 과거 순)
  const groups = useMemo(() => {
    const map: { key: string; year: number; month: number; items: Record[] }[] = [];
    for (const r of records) {
      const key = `${r.year}-${r.month}`;
      let g = map.find((x) => x.key === key);
      if (!g) { g = { key, year: r.year, month: r.month, items: [] }; map.push(g); }
      g.items.push(r);
    }
    return map;
  }, [records]);

  const createMut = useMutation({
    mutationFn: async (v: CoverSubmit) => {
      if (!userId) return;
      let mediaUrl: string | null = null;
      if (v.base64) mediaUrl = await uploadRecordImage(userId, v.base64, Date.now());
      else if (v.videoUri) mediaUrl = await uploadRecordVideo(userId, v.videoUri, Date.now());
      await createRecord(userId, v.date, mediaUrl, v.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['records'] }); setCreating(false); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  return (
    <Screen scroll>
      <BrandHeader />
      <View style={styles.headRow}>
        <Text variant="h1">기록</Text>
        <Button label="기록하기" onPress={() => (userId ? setCreating(true) : null)} style={styles.recordBtn} />
      </View>

      {groups.map((g) => (
        <View key={g.key} style={styles.group}>
          <Text variant="kicker" color={colors.light.textSecondary} style={styles.monthLabel}>{g.year}년 {g.month}월</Text>
          {g.items.map((r) => <RecordCard key={r.id} rec={r} onPress={() => router.push({ pathname: '/record/[id]', params: { id: r.id } })} />)}
        </View>
      ))}

      <CoverEditModal
        visible={creating}
        initialMessage={null}
        initialImage={null}
        saving={createMut.isPending}
        onClose={() => setCreating(false)}
        onSubmit={(v) => createMut.mutate(v)}
      />
    </Screen>
  );
}

function RecordCard({ rec, onPress }: { rec: Record; onPress: () => void }) {
  const isVideo = rec.media_url != null && /\.(mp4|mov|m4v)(\?|$)/i.test(rec.media_url);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {isVideo ? (
        <View style={[styles.cover, styles.coverEmpty]}><Text variant="h2" color={colors.light.textSecondary}>🎬 동영상</Text></View>
      ) : rec.media_url ? (
        <Image source={{ uri: rec.media_url }} style={styles.cover} />
      ) : null}
      <View style={styles.body}>
        {rec.record_date ? (
          <Text variant="caption" color={colors.light.textSecondary} style={{ marginBottom: 4 }}>{formatKo(rec.record_date)}</Text>
        ) : null}
        <Text variant="bodyBold" style={{ fontSize: 16 }} numberOfLines={3}>{rec.body?.trim() || '(내용 없음)'}</Text>
        <View style={styles.who}>
          <View style={[styles.dot, { backgroundColor: rec.color ?? colors.light.cobalt }]} />
          <Text variant="caption" color={colors.light.textSecondary}>{rec.nickname}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  recordBtn: { height: 40, paddingHorizontal: space.lg },
  group: { marginBottom: space.lg },
  monthLabel: { marginBottom: space.sm },
  card: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.light.hairline, overflow: 'hidden', marginBottom: space.md, backgroundColor: colors.light.paper },
  cover: { width: '100%', height: 180, backgroundColor: colors.light.surfacePlate },
  coverEmpty: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
