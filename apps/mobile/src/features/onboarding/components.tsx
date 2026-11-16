import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { LANGUAGES, useI18n } from '@/core/i18n';
import { colors, radius, spacing } from '@/core/theme';

import { onboardingAssets, type OnboardingImage } from './assets';

export const ONBOARDING_STEPS = 3;

/** Step indicator; the active step is a wider pill. */
export function PageDots({ index, count = ONBOARDING_STEPS }: { index: number; count?: number }) {
  return (
    <View
      style={styles.dots}
      accessible
      accessibilityLabel={`${index + 1} / ${count}`}
      accessibilityRole="progressbar"
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
      ))}
    </View>
  );
}

/** Flag + language code; tapping switches to the next language. */
export function LanguageButton() {
  const { language, setLanguage, t } = useI18n();
  const i = LANGUAGES.findIndex((l) => l.value === language);
  const current = LANGUAGES[i];
  const next = LANGUAGES[(i + 1) % LANGUAGES.length];
  return (
    <Pressable
      onPress={() => setLanguage(next.value)}
      accessibilityRole="button"
      accessibilityLabel={`${t.common.language}: ${current.label}`}
      style={({ pressed }) => [styles.language, pressed && { opacity: 0.7 }]}
    >
      <Text style={styles.languageLabel}>
        {current.flag} {current.label}
      </Text>
    </Pressable>
  );
}

export function Logo() {
  return (
    <View style={styles.logo}>
      <Image source={onboardingAssets.logo.source} style={styles.logoMark} />
      <Text style={styles.logoText}>Pozea</Text>
    </View>
  );
}

function CardImage({ image }: { image: OnboardingImage }) {
  return <Image source={image.source} resizeMode="cover" style={StyleSheet.absoluteFill} />;
}

/** Welcome screen: three pose cards fanned out, the middle one in front. Fits in `maxHeight`. */
export function PoseCardFan({ maxHeight = Infinity }: { maxHeight?: number }) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width * 0.38, 200, maxHeight / (1.42 * 1.15));
  const cardH = cardW * 1.42;
  const [left, centre, right] = onboardingAssets.welcome.cards;

  return (
    <View style={[styles.fan, { height: cardH * 1.15 }]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.card, styles.side, { width: cardW, height: cardH, transform: [{ translateX: -cardW * 0.72 }, { rotate: '-8deg' }] }]}>
        <CardImage image={left} />
      </View>
      <View style={[styles.card, styles.side, { width: cardW, height: cardH, transform: [{ translateX: cardW * 0.72 }, { rotate: '8deg' }] }]}>
        <CardImage image={right} />
      </View>
      <View style={[styles.card, styles.front, { width: cardW * 1.05, height: cardH * 1.05 }]}>
        <CardImage image={centre} />
      </View>
    </View>
  );
}

/** Guide screen: a large photo and three examples beside it. Fits in `maxHeight`. */
export function GuidePhotoStack({ maxHeight = Infinity }: { maxHeight?: number }) {
  const { width } = useWindowDimensions();
  const gap = spacing.sm;
  const mainW = Math.min((width - spacing.lg * 2 - gap) * 0.7, maxHeight / 1.3);
  const thumbW = (mainW * 0.3) / 0.7;
  const mainH = mainW * 1.3;
  const thumbH = (mainH - gap * 2) / 3;

  return (
    <View style={[styles.guide, { gap }]} importantForAccessibility="no-hide-descendants">
      <View style={[styles.photo, { width: mainW, height: mainH }]}>
        <Image source={onboardingAssets.guide.main.source} style={styles.photoImage} resizeMode="cover" />
      </View>
      <View style={{ gap }}>
        {onboardingAssets.guide.thumbs.map((thumb, i) => (
          <View key={i} style={[styles.photo, { width: thumbW, height: thumbH }]}>
            <Image source={thumb.source} style={styles.photoImage} resizeMode="cover" />
          </View>
        ))}
      </View>
    </View>
  );
}

const glow = `0 0 18px 2px ${colors.cyan}`;

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotActive: { width: 20, backgroundColor: colors.textOnNavy },
  language: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  languageLabel: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  logo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoMark: { width: 24, height: 24, borderRadius: 6 },
  logoText: { color: colors.textOnNavy, fontSize: 18, fontWeight: '800' },
  fan: { alignItems: 'center', justifyContent: 'center' },
  card: {
    position: 'absolute',
    backgroundColor: colors.paper,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(94, 224, 255, 0.55)',
  },
  side: { opacity: 0.92 },
  front: { boxShadow: glow },
  guide: { flexDirection: 'row', alignSelf: 'center' },
  photo: {
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.textOnNavy,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  photoImage: { width: '100%', height: '100%' },
});
