/**
 * S8. 마이페이지 — 프로필(사진·색·닉네임 편집 팝업) + 버그·문의 + 로그아웃.
 * 프사를 누르면 편집 팝업이 뜨고 거기서 사진/고유색/닉네임을 바꾼다.
 */
import { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { BrandHeader } from '@/components/BrandHeader';
import { ProfileEditModal } from '@/features/profile/ProfileEditModal';
import { VoteSection } from '@/features/vote/VoteSection';
import { colors, space } from '@/theme/tokens';
import { addMonths, todayStr } from '@/lib/date';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers, updateMyColor, updateMyNickname, uploadAvatar } from '@/api/members';
import { getHost } from '@/api/hosts';
import { signOut } from '@/api/auth';
import { useDevStore } from '@/store/devStore';

export default function MeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const setPreview = useDevStore((s) => s.setPreview);
  const preview = useDevStore((s) => s.previewMode);
  const [editOpen, setEditOpen] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });

  // 투표는 다음 모임(=다음 달) 기준. 그 달 담당자가 진행한다.
  const nextMonth = addMonths(todayStr(), 1);
  const vYear = Number(nextMonth.slice(0, 4));
  const vMonth = Number(nextMonth.slice(5, 7));
  const { data: nextHost } = useQuery({ queryKey: ['host', vYear, vMonth], queryFn: () => getHost(vYear, vMonth), enabled: !!userId });

  // 프사·닉네임은 홈 담당자, 달력, 댓글, 기록 등 화면 곳곳에 박혀 있다.
  // 6인 앱이라 쿼리 수가 적으니 키를 하나씩 세지 말고 전부(비활성 화면 포함) 다시 받아 즉시 동기화한다.
  const invalidate = () => qc.invalidateQueries({ refetchType: 'all' });
  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  const avatarMut = useMutation({ mutationFn: (v: { base64: string; ts: number }) => uploadAvatar(userId as string, v.base64, v.ts), onSuccess: invalidate, onError: onErr });
  const profileMut = useMutation({
    mutationFn: async (v: { nickname: string; color: string | null }) => {
      if (v.nickname.trim() && v.nickname.trim() !== me?.nickname) await updateMyNickname(userId as string, v.nickname);
      if (v.color && v.color !== me?.color) await updateMyColor(userId as string, v.color);
    },
    onSuccess: () => { invalidate(); setEditOpen(false); },
    onError: onErr,
  });

  async function pickPhoto() {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (res.canceled || !res.assets[0]?.base64) return;
    avatarMut.mutate({ base64: res.assets[0].base64, ts: Date.now() });
  }

  function openEdit() {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '프로필 편집은 로그인 후 이용할 수 있어요.');
      return;
    }
    setEditOpen(true);
  }

  async function onLogout() {
    setPreview(false);
    await signOut();
    router.replace('/sign-in');
  }

  const myColor = me?.color ?? colors.light.mist;

  return (
    <Screen scroll>
      <BrandHeader />
      <Text variant="h1">마이페이지</Text>

      <View style={styles.section}>
      <SectionHeader label="프로필" />
      <Card>
        <Pressable style={styles.profile} onPress={openEdit}>
          {me?.avatar_url ? (
            <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: myColor }]}>
              <Text variant="h2" color={colors.light.paper}>{(me?.nickname ?? '?').slice(0, 1)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{me?.nickname ?? (preview ? '둘러보기 (미로그인)' : '불러오는 중…')}</Text>
            <Text variant="caption" color={colors.light.textSecondary}>{me?.is_admin ? '관리자' : '멤버'} · 눌러서 편집</Text>
          </View>
          <Text variant="body" color={colors.light.textSecondary}>›</Text>
        </Pressable>
      </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader label="모임 날짜 투표" />
        <Card>
          {userId ? (
            <VoteSection
              userId={userId}
              meNickname={me?.nickname ?? '멤버'}
              isHost={nextHost?.member_id === userId}
              isAdmin={!!me?.is_admin}
              year={vYear}
              month={vMonth}
              memberIds={members.map((m) => m.id)}
            />
          ) : (
            <Text variant="bodySm" color={colors.light.textSecondary}>로그인 후 이용할 수 있어요.</Text>
          )}
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader label="설정" />
        <Card>
          <Pressable style={styles.linkRow} onPress={() => router.push('/account')}>
            <Text variant="bodyBold" style={{ fontSize: 15 }}>내 정보 수정</Text>
            <Text variant="body" color={colors.light.textSecondary}>›</Text>
          </Pressable>
        </Card>
        <Card style={{ marginTop: space.md }}>
          <Pressable style={styles.linkRow} onPress={() => router.push('/feedback')}>
            <Text variant="bodyBold" style={{ fontSize: 15 }}>문의 보내기</Text>
            <Text variant="body" color={colors.light.textSecondary}>›</Text>
          </Pressable>
        </Card>
      </View>

      <Button label={preview ? '로그인 화면으로' : '로그아웃'} variant="secondary" block onPress={onLogout} style={styles.logout} />

      {/* 저작권 — 만든 사람 */}
      <View style={styles.footer}>
        <Text variant="caption" color={colors.light.textSecondary} style={styles.footerLine}>
          © {new Date().getFullYear()} 김윤후
        </Text>
        <Text variant="caption" color={colors.light.textSecondary} style={styles.footerLine}>
          가천대학교 응용통계학과 10학번
        </Text>
        <Text
          variant="caption"
          color={colors.light.textSecondary}
          style={styles.footerLine}
          onPress={() => Linking.openURL('mailto:yunhu0110@gmail.com')}
        >
          yunhu0110@gmail.com
        </Text>
      </View>

      <ProfileEditModal
        visible={editOpen}
        nickname={me?.nickname ?? ''}
        color={me?.color ?? null}
        avatarUrl={me?.avatar_url ?? null}
        busy={profileMut.isPending || avatarMut.isPending}
        onClose={() => setEditOpen(false)}
        onPickPhoto={pickPhoto}
        onSaveProfile={(n, c) => profileMut.mutate({ nickname: n, color: c })}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: space.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logout: { marginTop: space.section },
  footer: {
    alignItems: 'center',
    gap: 2,
    marginTop: space.xl,
    paddingTop: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.light.hairline,
  },
  footerLine: { textAlign: 'center' },
});
