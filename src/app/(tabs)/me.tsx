/**
 * S8. 마이페이지 — 프로필(사진·색·닉네임 편집 팝업) + 버그·문의 + 로그아웃.
 * 프사를 누르면 편집 팝업이 뜨고 거기서 사진/고유색/닉네임을 바꾼다.
 */
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { ProfileEditModal } from '@/features/profile/ProfileEditModal';
import { colors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, updateMyColor, updateMyNickname, uploadAvatar } from '@/api/members';
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

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['me'] });
    qc.invalidateQueries({ queryKey: ['members'] });
    qc.invalidateQueries({ queryKey: ['availability-rows'] });
    qc.invalidateQueries({ queryKey: ['host'] });
  };
  const onErr = (e: unknown) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.');

  const avatarMut = useMutation({ mutationFn: (v: { base64: string; ts: number }) => uploadAvatar(userId as string, v.base64, v.ts), onSuccess: invalidate, onError: onErr });
  const colorMut = useMutation({ mutationFn: (c: string) => updateMyColor(userId as string, c), onSuccess: invalidate, onError: onErr });
  const nickMut = useMutation({ mutationFn: (n: string) => updateMyNickname(userId as string, n), onSuccess: () => { invalidate(); setEditOpen(false); }, onError: onErr });

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
      <Text variant="h1">마이페이지</Text>

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

      <SectionHeader label="도움말" />
      <Card>
        <Pressable style={styles.linkRow} onPress={() => router.push('/feedback')}>
          <Text variant="bodyBold" style={{ fontSize: 15 }}>버그·문의 보내기</Text>
          <Text variant="body" color={colors.light.textSecondary}>›</Text>
        </Pressable>
      </Card>

      <SectionHeader label="계정" />
      <Card>
        <Button label={preview ? '로그인 화면으로' : '로그아웃'} variant="secondary" block onPress={onLogout} />
      </Card>

      <ProfileEditModal
        visible={editOpen}
        nickname={me?.nickname ?? ''}
        color={me?.color ?? null}
        avatarUrl={me?.avatar_url ?? null}
        busy={nickMut.isPending || avatarMut.isPending || colorMut.isPending}
        onClose={() => setEditOpen(false)}
        onPickPhoto={pickPhoto}
        onSaveNickname={(n) => nickMut.mutate(n)}
        onPickColor={(c) => colorMut.mutate(c)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
