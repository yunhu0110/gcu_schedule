/**
 * S4. 게임(보드게임) — 운영자가 직접 만든 게임을 카드로 나열. 누르면 웹 링크로 외부 브라우저 이동.
 * 운영자는 '등록', 일반 멤버는 '요청하기' 버튼. 운영자는 카드 롱프레스로 수정/삭제.
 */
import { useState } from 'react';
import { ActionSheetIOS, Alert, Image, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { BrandHeader } from '@/components/BrandHeader';
import { GameEditModal, type GameSubmit } from '@/features/games/GameEditModal';
import { GameRequestModal, type GameRequest } from '@/features/games/GameRequestModal';
import { colors, radius, space } from '@/theme/tokens';
import { useAuth } from '@/features/auth/AuthContext';
import { getMyProfile, listMembers } from '@/api/members';
import { notifyMembers } from '@/api/notifications';
import { createGame, deleteGame, listGames, normalizeUrl, updateGame, uploadGameThumbnail, type Game } from '@/api/games';

export default function GameScreen() {
  const { userId } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Game | 'new' | null>(null);
  const [requesting, setRequesting] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me', userId], queryFn: () => getMyProfile(userId as string), enabled: !!userId });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: !!userId });
  const { data: games = [] } = useQuery({ queryKey: ['games'], queryFn: listGames, enabled: !!userId });

  const isAdmin = !!me?.is_admin;

  const saveMut = useMutation({
    mutationFn: async (v: GameSubmit) => {
      if (!userId) return;
      let thumb: string | null = v.keepThumbnail;
      if (v.base64) thumb = await uploadGameThumbnail(userId, v.base64, Date.now());
      const input = { title: v.title, url: v.url, description: v.description, genre: v.genre, thumbnail_url: thumb };
      if (editing && editing !== 'new') await updateGame(editing.id, input);
      else await createGame(userId, input);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['games'] }); setEditing(null); },
    onError: (e) => Alert.alert('오류', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteGame(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['games'] }),
    onError: (e) => Alert.alert('삭제 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  const requestMut = useMutation({
    mutationFn: async (v: GameRequest) => {
      if (!userId) throw new Error('로그인이 필요해요.');
      const admins = members.filter((m) => m.is_admin).map((m) => m.id);
      if (admins.length === 0) throw new Error('운영자를 찾을 수 없어요.');
      const nick = me?.nickname ?? '멤버';
      const parts = [`[게임 요청] ${v.title.trim() || '(게임명 없음)'}`];
      if (v.url.trim()) parts.push(`URL: ${normalizeUrl(v.url)}`);
      if (v.note.trim()) parts.push(v.note.trim());
      parts.push(`(from ${nick})`);
      await notifyMembers(userId, admins, 'game_request', parts.join(' — '), true);
    },
    onSuccess: () => { Alert.alert('요청 완료', '운영자에게 요청이 전달됐어요.'); setRequesting(false); },
    onError: (e) => Alert.alert('전송 실패', e instanceof Error ? e.message : '다시 시도해주세요.'),
  });

  async function openGame(g: Game) {
    const url = normalizeUrl(g.url);
    const ok = await Linking.canOpenURL(url).catch(() => false);
    if (!ok) { Alert.alert('열 수 없는 링크예요', url); return; }
    Linking.openURL(url).catch(() => Alert.alert('열 수 없는 링크예요', url));
  }

  function manageGame(g: Game) {
    if (!isAdmin) return;
    const doDelete = () =>
      Alert.alert('게임 삭제', `'${g.title}'을(를) 삭제할까요?`, [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => deleteMut.mutate(g.id) },
      ]);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['취소', '수정', '삭제'], destructiveButtonIndex: 2, cancelButtonIndex: 0, title: g.title },
        (i) => { if (i === 1) setEditing(g); else if (i === 2) doDelete(); },
      );
    } else {
      Alert.alert(g.title, undefined, [
        { text: '취소', style: 'cancel' },
        { text: '수정', onPress: () => setEditing(g) },
        { text: '삭제', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  return (
    <Screen scroll>
      <BrandHeader />
      <View style={styles.headRow}>
        <Text variant="h1">보드게임</Text>
        {isAdmin ? (
          <Button label="+ 등록" onPress={() => setEditing('new')} style={styles.topBtn} />
        ) : (
          <Button label="요청하기" variant="secondary" onPress={() => setRequesting(true)} style={styles.topBtn} />
        )}
      </View>

      {games.length === 0 ? (
        <Text variant="body" color={colors.light.textSecondary} style={{ marginTop: space.xl }}>
          {isAdmin ? '아직 등록된 게임이 없어요. + 등록으로 첫 게임을 올려보세요.' : '아직 등록된 게임이 없어요.'}
        </Text>
      ) : (
        <View style={styles.grid}>
          {games.map((g) => (
            <GameCard key={g.id} game={g} onPress={() => openGame(g)} onLongPress={() => manageGame(g)} />
          ))}
        </View>
      )}

      {isAdmin ? (
        <GameEditModal
          visible={editing != null}
          initial={editing && editing !== 'new' ? editing : null}
          saving={saveMut.isPending}
          onClose={() => setEditing(null)}
          onSubmit={(v) => saveMut.mutate(v)}
        />
      ) : (
        <GameRequestModal
          visible={requesting}
          saving={requestMut.isPending}
          onClose={() => setRequesting(false)}
          onSubmit={(v) => requestMut.mutate(v)}
        />
      )}
    </Screen>
  );
}

function GameCard({ game, onPress, onLongPress }: { game: Game; onPress: () => void; onLongPress: () => void }) {
  const initial = game.title.trim().charAt(0) || '?';
  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress} delayLongPress={350}>
      <View style={styles.thumbWrap}>
        {game.thumbnail_url ? (
          <Image source={{ uri: game.thumbnail_url }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]}>
            <Text variant="h1" color={colors.light.textSecondary}>{initial}</Text>
          </View>
        )}
        <View style={styles.linkBadge}>
          <Text variant="caption" color={colors.light.paper} style={styles.linkBadgeText}>↗</Text>
        </View>
      </View>
      <View style={styles.body}>
        {game.genre ? (
          <Text variant="kicker" color={colors.light.cobalt} numberOfLines={1}>{game.genre}</Text>
        ) : null}
        <Text variant="bodyBold" style={{ fontSize: 15 }} numberOfLines={1}>{game.title}</Text>
        {game.description ? (
          <Text variant="caption" color={colors.light.textSecondary} numberOfLines={1}>{game.description}</Text>
        ) : null}
        <View style={styles.who}>
          <View style={[styles.dot, { backgroundColor: game.color ?? colors.light.cobalt }]} />
          <Text variant="caption" color={colors.light.textSecondary} numberOfLines={1}>{game.nickname}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  topBtn: { height: 40, paddingHorizontal: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  card: { width: '48%', borderRadius: radius.card, borderWidth: 1, borderColor: colors.light.hairline, overflow: 'hidden', backgroundColor: colors.light.paper },
  thumbWrap: { width: '100%', aspectRatio: 1 },
  thumb: { width: '100%', height: '100%', backgroundColor: colors.light.surfacePlate },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  linkBadge: { position: 'absolute', top: space.sm, right: space.sm, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.light.ink60, alignItems: 'center', justifyContent: 'center' },
  linkBadgeText: { fontSize: 14, lineHeight: 16 },
  body: { padding: space.md, gap: 2 },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
