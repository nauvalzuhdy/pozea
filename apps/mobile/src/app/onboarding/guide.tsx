import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/core/i18n';
import { colors, spacing } from '@/core/theme';
import { Badge, PrimaryButton, TextButton } from '@/core/ui';
import { onboardingAssets } from '@/features/onboarding/assets';
import { GuidePhotoStack, Logo, PageDots } from '@/features/onboarding/components';
import { useOnboarding } from '@/features/onboarding/state';

export default function GuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { finish } = useOnboarding();
  // Space left for the artwork once the text and button are laid out.
  const [heroH, setHeroH] = useState(0);
  const copy = t.onboarding.guide;

  return (
    <View style={styles.screen}>
      <Image source={onboardingAssets.guide.main.source} style={StyleSheet.absoluteFill} blurRadius={30} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />

      <View style={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.topBar}>
          <Logo />
          <TextButton label={t.common.skip} onPress={finish} />
        </View>

        <View style={styles.hero} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
          <GuidePhotoStack maxHeight={heroH || undefined} />
        </View>

        <View style={styles.copy}>
          <Badge label={copy.badge} />
          <Text style={styles.title} accessibilityRole="header">
            {copy.title}
          </Text>
          <Text style={styles.body}>{copy.body}</Text>
          <PageDots index={1} />
        </View>

        <PrimaryButton label={copy.cta} onPress={() => router.push('/onboarding/paywall')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  scrim: { backgroundImage: 'linear-gradient(180deg, rgba(11,21,48,0.55) 0%, rgba(11,21,48,0.85) 55%, #0B1530 80%)' },
  content: { flex: 1, paddingHorizontal: spacing.lg, gap: spacing.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.sm },
  hero: { flex: 1, minHeight: 0, justifyContent: 'center' },
  copy: { gap: spacing.md, paddingHorizontal: spacing.sm },
  title: { color: colors.textOnNavy, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  body: { color: colors.mutedOnNavy, fontSize: 16, lineHeight: 24 },
});
