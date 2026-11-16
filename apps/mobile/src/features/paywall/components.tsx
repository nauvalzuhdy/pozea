import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/core/theme';
import { Badge } from '@/core/ui';

export function PlanCard({
  priceString,
  period,
  badge,
  selected,
  onPress,
}: {
  priceString: string;
  period: string;
  badge?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[priceString, period, badge].filter(Boolean).join(', ')}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
        {priceString}
      </Text>
      <View style={styles.planFooter}>
        <Text style={styles.period}>{period}</Text>
        {badge ? <Badge label={badge} tone="green" /> : null}
      </View>
    </Pressable>
  );
}

export function FeatureRow({
  icon,
  label,
  last,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.feature, !last && styles.featureDivider]}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.cyan} />
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  plan: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navy,
  },
  planSelected: { borderColor: colors.cyan, backgroundColor: colors.surfaceSelected },
  price: { color: colors.textOnNavy, fontSize: 22, fontWeight: '600' },
  planFooter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, minHeight: 24 },
  period: { color: colors.mutedOnNavy, fontSize: 15 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 10 },
  featureDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.navyBorder },
  featureLabel: { flex: 1, color: colors.textOnNavy, fontSize: 15, lineHeight: 21 },
});
