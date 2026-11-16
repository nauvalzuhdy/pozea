import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

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

export type ButtonVariant = 'blue' | 'light' | 'gradient';

type PrimaryButtonProps = {
  label: string;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
} & ({ href: Href; onPress?: never } | { onPress: () => void; href?: never });

export function PrimaryButton({ label, href, onPress, variant = 'blue', style }: PrimaryButtonProps) {
  const button = (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.primary, variantStyles[variant], pressed && styles.pressed, style]}
    >
      <Text style={[styles.primaryLabel, variant === 'light' && styles.primaryLabelDark]}>{label}</Text>
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {button}
    </Link>
  ) : (
    button
  );
}

/** Text-only button for secondary actions such as Skip or footer links. */
export function TextButton({
  label,
  onPress,
  size = 'md',
}: {
  label: string;
  onPress: () => void;
  size?: 'sm' | 'md';
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={spacing.md}>
      {({ pressed }) => (
        <Text style={[size === 'sm' ? styles.textButtonSm : styles.textButton, pressed && styles.pressedText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Small pill label, e.g. "LIVE POSE GUIDE", "PRO" or "Save 45%". */
export function Badge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'outline' }) {
  return (
    <View style={[styles.badge, badgeTones[tone]]}>
      <Text style={[styles.badgeLabel, tone === 'green' && styles.badgeLabelDark, tone === 'outline' && styles.badgeLabelCyan]}>
        {label}
      </Text>
    </View>
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
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.85 },
  primaryLabel: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  primaryLabelDark: { color: colors.textDark },
  textButton: { color: colors.textOnNavy, fontSize: 16, fontWeight: '600' },
  textButtonSm: { color: colors.mutedOnNavy, fontSize: 13 },
  pressedText: { opacity: 0.6 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeLabel: { color: colors.textOnNavy, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  badgeLabelDark: { color: colors.textDark },
  badgeLabelCyan: { color: colors.cyan },
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

const variantStyles = StyleSheet.create({
  blue: { backgroundColor: colors.blue },
  light: { backgroundColor: colors.light },
  gradient: { backgroundColor: colors.blue, backgroundImage: `linear-gradient(90deg, ${colors.blue}, #4FA8FF)` },
});

const badgeTones = StyleSheet.create({
  blue: { backgroundColor: colors.blue },
  green: { backgroundColor: colors.green },
  outline: { borderWidth: 1.5, borderColor: colors.cyan },
});
