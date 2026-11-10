/**
 * 이벤트 탭 — 스팟성 이벤트 카드 목록.
 * 데블스 플랜은 실제 배너(제목 박힌 이미지), 화살표 버튼 없음 — 카드 전체가 탭 영역.
 * ⚠️ 프론트 전용: events 백엔드는 추후.
 */
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { BrandHeader } from '@/components/BrandHeader';
import { colors, radius, shadow, space } from '@/theme/tokens';
import { DEVIL_BANNER, DEVIL_META } from '@/features/event/devilAssets';

export default function EventsScreen() {
  const router = useRouter();
  return (
    <Screen scroll>
      <BrandHeader />

      <Text variant="h1">이벤트</Text>
      <Text variant="body" color={colors.light.textSecondary} style={styles.subtitle}>
        스팟성 이벤트
      </Text>

      {/* 데블스 플랜 — 배너 전체가 탭 영역. 하단에 날짜만. */}
      <Pressable
        onPress={() => router.push('/event/devils-plan')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <ImageBackground source={DEVIL_BANNER} style={styles.banner} imageStyle={styles.bannerImg}>
          <View style={styles.bottomScrim} />
          <View style={styles.bannerFoot}>
            <Text variant="bodySm" color={colors.light.paper} style={styles.date}>{DEVIL_META.period}</Text>
          </View>
        </ImageBackground>
      </Pressable>

      <Text variant="caption" color={colors.light.textSecondary} style={styles.note}>
        새로운 이벤트가 열리면 여기에 카드로 올라와요.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: space.xs, marginBottom: space.xl },
  card: { borderRadius: radius.hero, overflow: 'hidden', ...shadow.hero },
  pressed: { opacity: 0.94 },
  banner: { aspectRatio: 16 / 9, justifyContent: 'flex-end' },
  bannerImg: { borderRadius: radius.hero },
  bottomScrim: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: 56,
    backgroundColor: 'rgba(8,10,18,0.40)',
  },
  bannerFoot: { padding: space.lg },
  date: { fontSize: 13 },
  note: { textAlign: 'center', marginTop: space.section },
});
