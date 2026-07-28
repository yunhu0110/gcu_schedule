/**
 * DayDetailModal — 달력에서 날짜를 누르면 뜨는 "그 날 누가 가능/불가한지" 상세 팝업.
 * 가능 · 불가 · 미입력 3그룹으로 멤버를 보여주고(색·시간 포함), 내 일정 입력/수정으로 넘어간다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, View, Image } from 'react-native';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { colors, radius, space } from '@/theme/tokens';
import { formatKo, type DateStr } from '@/lib/date';
import type { AvailRow } from '@/api/availabilities';
import type { Member } from '@/api/members';

type Props = {
  visible: boolean;
  date: DateStr | null;
  rows: AvailRow[]; // 그 날짜의 입력 행들
  members: Member[]; // 활성 멤버 전체
  onClose: () => void;
  onEdit: () => void;
};

const fmtTime = (s: string | null) => (s ? s.slice(0, 5) : null);
function timeLabel(r: AvailRow): string {
  const a = fmtTime(r.start_time);
  const b = fmtTime(r.end_time);
  return a && b ? `${a}–${b}` : '종일';
}

export function DayDetailModal({ visible, date, rows, members, onClose, onEdit }: Props) {
  const available = rows.filter((r) => r.status === 'available');
  const unavailable = rows.filter((r) => r.status === 'unavailable');
  const answeredIds = new Set(rows.map((r) => r.member_id));
  const missing = members.filter((m) => !answeredIds.has(m.id));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">{date ? formatKo(date) : ''}</Text>
        <Text variant="bodySm" color={colors.light.textSecondary} style={{ marginTop: space.xs }}>
          가능 {available.length} · 불가 {unavailable.length} · 미입력 {missing.length}
        </Text>

        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <Group title="가능" tint={colors.light.available}>
            {available.map((r) => (
              <MemberLine key={r.member_id} color={r.color} avatar={r.avatar_url} name={r.nickname} right={timeLabel(r)} />
            ))}
            {available.length === 0 && <Empty />}
          </Group>

          <Group title="불가" tint={colors.light.unavailable}>
            {unavailable.map((r) => (
              <MemberLine key={r.member_id} color={r.color} avatar={r.avatar_url} name={r.nickname} right={timeLabel(r)} />
            ))}
            {unavailable.length === 0 && <Empty />}
          </Group>

          <Group title="미입력" tint={colors.light.slate}>
            {missing.map((m) => (
              <MemberLine key={m.id} color={m.color} avatar={m.avatar_url} name={m.nickname} right="—" dim />
            ))}
            {missing.length === 0 && <Empty />}
          </Group>
        </ScrollView>

        <Button label="내 일정 입력 / 수정" block onPress={onEdit} style={{ marginTop: space.md }} />
        <Button label="닫기" variant="ghost" block onPress={onClose} />
      </View>
    </Modal>
  );
}

function Group({ title, tint, children }: { title: string; tint: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <View style={[styles.groupDot, { backgroundColor: tint }]} />
        <Text variant="kicker" color={colors.light.textSecondary}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

function MemberLine({
  color,
  avatar,
  name,
  right,
  dim,
}: {
  color: string | null;
  avatar: string | null;
  name: string;
  right: string;
  dim?: boolean;
}) {
  return (
    <View style={[styles.line, dim && { opacity: 0.55 }]}>
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, { backgroundColor: color ?? colors.light.mist }]}>
          <Text variant="caption" color={colors.light.paper}>
            {name.slice(0, 1)}
          </Text>
        </View>
      )}
      <Text variant="bodyBold" style={{ flex: 1, fontSize: 15 }}>
        {name}
      </Text>
      <Text variant="mono" color={colors.light.textSecondary} style={{ fontSize: 12 }}>
        {right}
      </Text>
    </View>
  );
}

const Empty = () => (
  <Text variant="bodySm" color={colors.light.ink24} style={{ paddingVertical: space.xs }}>
    없음
  </Text>
);

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.light.ink60 },
  sheet: {
    backgroundColor: colors.light.paper,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    padding: space.screen,
    paddingBottom: space.section,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.light.hairlineStrong, alignSelf: 'center', marginBottom: space.md },
  group: { marginTop: space.lg },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.sm },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 7 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
