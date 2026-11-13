import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/core/theme';

export function Screen({ children }: { children: ReactNode }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Body({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function PrimaryButton({ label, href }: { label: string; href: Href }) {
  return (
    <Link href={href} asChild>
      <Pressable style={styles.primary} accessibilityRole="button">
        <Text style={styles.primaryLabel}>{label}</Text>
      </Pressable>
    </Link>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.textOnNavy, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  body: { color: colors.mutedOnNavy, fontSize: 16, lineHeight: 24 },
  primary: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  primaryLabel: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  chip: {
    borderColor: colors.navyBorder,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  chipLabel: { color: colors.mutedOnNavy, fontSize: 15, fontWeight: '600' },
  chipLabelSelected: { color: colors.textOnNavy },
});
