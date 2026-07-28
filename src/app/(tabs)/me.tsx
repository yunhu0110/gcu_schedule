/**
 * S8. 마이페이지 — 프로필(사진 등록 + 표시색 선택) + 로그아웃.
 * 표시색은 달력 상세/후보에서 나를 나타내는 색이 된다. 사진은 avatars 버킷에 올린다.
 */
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { colors, memberColors, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, updateMyColor, uploadAvatar } from '@/api/members';
import { signOut } from '@/api/auth';
import { useDevStore } from '@/store/devStore';

export default function MeScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const qc = useQueryClient();
  const setPreview = useDevStore((s) => s.setPreview);
  const preview = useDevStore((s) => s.previewMode);

  const { data: me } = useQuery({
    queryKey: ['me', userId],
    queryFn: () => getMyProfile(userId as string),
    enabled: !!userId,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['me'] });
    qc.invalidateQueries({ queryKey: ['members'] });
    qc.invalidateQueries({ queryKey: ['availability-rows'] });
  };

  const avatarMut = useMutation({
    mutationFn: (v: { base64: string; ts: number }) => uploadAvatar(userId as string, v.base64, v.ts),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('사진 업로드 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const colorMut = useMutation({
    mutationFn: (color: string) => updateMyColor(userId as string, color),
    onSuccess: invalidate,
    onError: (e) => Alert.alert('색 변경 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  async function pickAvatar() {
    if (!userId) {
      Alert.alert('로그인이 필요해요', '사진 등록은 로그인 후 이용할 수 있어요.');
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('권한 필요', '사진 라이브러리 접근을 허용해주세요.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    avatarMut.mutate({ base64: res.assets[0].base64, ts: Date.now() });
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
        <View style={styles.profile}>
          <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
            {me?.avatar_url ? (
              <Image source={{ uri: me.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: myColor }]}>
                <Text variant="h2" color={colors.light.paper}>
                  {(me?.nickname ?? '?').slice(0, 1)}
                </Text>
              </View>
            )}
            <View style={styles.camBadge}>
              {avatarMut.isPending ? (
                <ActivityIndicator size="small" color={colors.light.paper} />
              ) : (
                <Text variant="caption" color={colors.light.paper}>＋</Text>
              )}
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text variant="bodyBold">{me?.nickname ?? (preview ? '둘러보기 (미로그인)' : '불러오는 중…')}</Text>
            <Text variant="caption" color={colors.light.textSecondary}>
              {me?.is_admin ? '관리자' : '멤버'} · 사진을 눌러 변경
            </Text>
          </View>
        </View>
      </Card>

      <SectionHeader label="표시색 (달력에서 나를 나타내는 색)" />
      <Card>
        <View style={styles.swatches}>
          {memberColors.map((c) => {
            const on = me?.color === c;
            return (
              <Pressable
                key={c}
                onPress={() => !colorMut.isPending && me && colorMut.mutate(c)}
                style={[styles.swatch, { backgroundColor: c }, on && styles.swatchOn]}
              >
                {on ? <Text variant="bodyBold" color={colors.light.paper}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <SectionHeader label="계정" />
      <Card>
        <Text variant="bodySm" color={colors.light.textSecondary}>
          상시 불가 요일·알림 설정·내 통계는 이후 마일스톤에서 추가돼요.
        </Text>
        <Button label={preview ? '로그인 화면으로' : '로그아웃'} variant="secondary" block style={{ marginTop: space.md }} onPress={onLogout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatarWrap: { width: 56, height: 56 },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  camBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.light.cobalt,
    borderWidth: 2,
    borderColor: colors.light.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  swatchOn: { borderWidth: 3, borderColor: colors.light.ink },
});
