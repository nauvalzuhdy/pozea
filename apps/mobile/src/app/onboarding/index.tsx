import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/core/i18n';
import { colors, spacing } from '@/core/theme';
import { PrimaryButton, TextButton } from '@/core/ui';
import { LanguageButton, PageDots, PoseCardFan } from '@/features/onboarding/components';
import { useOnboarding } from '@/features/onboarding/state';
import { POSES } from '@/features/poses/catalog';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { finish } = useOnboarding();
  // Space left for the artwork once the text and button are laid out.
  const [heroH, setHeroH] = useState(0);
  const copy = t.onboarding.welcome;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.topBar}>
        <LanguageButton />
        <TextButton label={t.common.skip} onPress={finish} />
      </View>

      <View style={styles.hero} onLayout={(e) => setHeroH(e.nativeEvent.layout.height)}>
        <PoseCardFan maxHeight={heroH || undefined} />
      </View>

      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title} accessibilityRole="header">
          {copy.titleStart}
          <Text style={styles.titleAccent}>{copy.titleAccent}</Text>
        </Text>
        <Text style={styles.body}>{copy.body(POSES.length)}</Text>
      </View>

      <View style={styles.footer}>
        <PageDots index={0} />
        <PrimaryButton label={copy.cta} variant="light" onPress={() => router.push('/onboarding/guide')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy, paddingHorizontal: spacing.xl },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hero: { flex: 1, minHeight: 0, justifyContent: 'center' },
  copy: { alignItems: 'center', gap: spacing.sm },
  eyebrow: { color: colors.mutedOnNavy, fontSize: 13, fontWeight: '600', letterSpacing: 1 },
  title: { color: colors.textOnNavy, fontSize: 30, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  titleAccent: {
    fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }),
    fontStyle: 'italic',
    fontWeight: '400',
    color: colors.mutedOnNavy,
  },
  body: { color: colors.mutedOnNavy, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  footer: { alignItems: 'center', gap: spacing.xl, marginTop: spacing.xl },
});
