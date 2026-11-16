import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/core/i18n';
import { colors, spacing } from '@/core/theme';
import { PrimaryButton, TextButton } from '@/core/ui';
import { onboardingAssets } from '@/features/onboarding/assets';
import { useOnboarding } from '@/features/onboarding/state';
import { billing, yearlySavingPercent, type Plan, type PlanId } from '@/features/paywall/billing';
import { FeatureRow, PlanCard } from '@/features/paywall/components';
import { LEGAL_URLS, PRO_FEATURES } from '@/features/paywall/content';

/**
 * One fixed screen, no scrolling: the plans, features and button keep their size and the hero
 * artwork takes whatever height is left (at most its natural height, shrinking on short phones).
 */
export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t } = useI18n();
  const { finish } = useOnboarding();
  const copy = t.paywall;
  const { hero } = onboardingAssets.paywall;

  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState(false);
  const [screenH, setScreenH] = useState(0);
  const [bodyH, setBodyH] = useState(0);

  useEffect(() => {
    let alive = true;
    billing.loadPlans().then((loaded) => alive && setPlans(loaded), () => alive && setPlans([]));
    return () => {
      alive = false;
    };
  }, []);

  const naturalHeroH = width / hero.aspectRatio;
  const heroH = screenH && bodyH ? Math.max(0, Math.min(naturalHeroH, screenH - bodyH)) : naturalHeroH;
  const saving = plans ? yearlySavingPercent(plans) : null;

  const start = async () => {
    const plan = plans?.find((p) => p.id === selected);
    if (!plan || busy) return;
    setBusy(true);
    const result = await billing.purchase(plan);
    setBusy(false);
    if (result.status === 'error') Alert.alert(result.message);
    // Preview has no real purchase yet: continue to Home. A cancelled purchase stays here.
    else if (result.status !== 'cancelled') finish();
  };

  const restore = async () => {
    const result = await billing.restore();
    if (result.status === 'restored') finish();
    else Alert.alert(result.status === 'error' ? result.message : copy.restoreNone);
  };

  const openLegal = (url: string | undefined) => (url ? Linking.openURL(url) : Alert.alert(t.common.comingSoon));

  return (
    <View style={styles.screen} onLayout={(e) => setScreenH(e.nativeEvent.layout.height)}>
      <View style={{ height: heroH }}>
        {/* The artwork carries the logo and headline; screen readers get the same text. */}
        <Image
          source={hero.source}
          style={styles.heroImage}
          resizeMode="contain"
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${copy.heroOverline}. ${copy.heroTitle}, ${copy.heroSubtitle}. ${copy.tagline}`}
        />
      </View>

      <View style={styles.spacer} />

      <View style={[styles.body, { paddingBottom: insets.bottom + spacing.md }]} onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}>
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{copy.choosePlan}</Text>
          {plans === null ? (
            <ActivityIndicator color={colors.cyan} style={styles.loading} />
          ) : (
            <View style={styles.plans} accessibilityRole="radiogroup">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  priceString={plan.priceString}
                  period={plan.id === 'monthly' ? copy.monthly : copy.yearly}
                  badge={plan.id === 'yearly' && saving ? copy.save(saving) : undefined}
                  selected={plan.id === selected}
                  onPress={() => setSelected(plan.id)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{copy.joinPro}</Text>
          <View style={styles.features}>
            {PRO_FEATURES.map((f, i) => (
              <FeatureRow key={f.key} icon={f.icon} label={copy.features[f.key]} last={i === PRO_FEATURES.length - 1} />
            ))}
          </View>
        </View>

        <Text style={styles.cancel}>{copy.cancelAnytime(billing.storeName)}</Text>
        <PrimaryButton label={copy.cta} variant="gradient" onPress={start} style={busy && styles.busy} />

        <View style={styles.legal}>
          <TextButton size="sm" label={copy.privacy} onPress={() => openLegal(LEGAL_URLS.privacy)} />
          <Text style={styles.separator}>|</Text>
          <TextButton size="sm" label={copy.terms} onPress={() => openLegal(LEGAL_URLS.terms)} />
          <Text style={styles.separator}>|</Text>
          <TextButton size="sm" label={copy.restore} onPress={restore} />
        </View>
      </View>

      <Pressable
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel={t.common.close}
        hitSlop={spacing.md}
        style={[styles.close, { top: insets.top + spacing.sm }]}
      >
        <Ionicons name="close" size={26} color={colors.textOnNavy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  heroImage: { width: '100%', height: '100%' },
  spacer: { flex: 1 },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.navyLine,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  panelTitle: { color: colors.mutedOnNavy, fontSize: 14, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  plans: { flexDirection: 'row', gap: spacing.sm },
  loading: { paddingVertical: spacing.xxl },
  features: { backgroundColor: colors.navy, borderRadius: 16, paddingHorizontal: spacing.md },
  cancel: { color: colors.mutedOnNavy, fontSize: 13, textAlign: 'center' },
  busy: { opacity: 0.6 },
  legal: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  separator: { color: colors.navyBorder },
});
