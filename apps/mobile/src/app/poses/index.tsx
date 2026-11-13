import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/core/theme';
import { CATEGORIES, findCategory, posesIn, type CategoryId, type Pose } from '@/features/poses/catalog';

const SELECTED = '#5EE0FF';

/** What a pose asks for, as short tags on its card. */
function tagsFor(pose: Pose): string[] {
  const t = pose.template;
  const tags: string[] = [];
  if (t.freeHand || t.hands.left || t.hands.right) tags.push('Gaya tangan');
  if ((t.joints.headTilt?.angle ?? 0) > 0 || (t.joints.faceTurn?.angle ?? 0) > 0) tags.push('Sudut wajah');
  if (t.face?.smileMin != null) tags.push('Senyum');
  return tags;
}

/**
 * Pose menu: pick a category, then a pose; the camera opens on it. The setup screen's filters
 * (type, place, ratio) are not used yet: the local catalog has one list per category.
 */
export default function PoseMenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string }>();
  const [category, setCategory] = useState<CategoryId>(params.category === 'body' ? 'body' : 'selfie');
  const poses = posesIn(category);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {CATEGORIES.map((c) => {
          const selected = c.id === category;
          return (
            <Pressable
              key={c.id}
              onPress={() => setCategory(c.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabLabel, selected && styles.tabLabelSelected]}>{c.title}</Text>
              <Text style={[styles.tabCount, selected && styles.tabLabelSelected]}>{posesIn(c.id).length} pose</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.description}>{findCategory(category).description}</Text>

      <View style={styles.grid}>
        {poses.map((pose) => (
          <Pressable
            key={pose.slug}
            onPress={() => router.push({ pathname: '/camera/[poseId]', params: { poseId: pose.slug } })}
            accessibilityRole="button"
            accessibilityLabel={`${pose.title}. ${pose.description}`}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Image source={pose.thumbnail} style={styles.thumbnail} resizeMode="cover" />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {pose.title}
              </Text>
              <Text style={styles.cardDescription} numberOfLines={2}>
                {pose.description}
              </Text>
              <View style={styles.tags}>
                {tagsFor(pose).map((tag) => (
                  <Text key={tag} style={styles.tag}>
                    {tag}
                  </Text>
                ))}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.navy },
  content: { padding: spacing.lg, gap: spacing.md },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.navyLine,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabSelected: { backgroundColor: colors.blue },
  tabLabel: { color: colors.mutedOnNavy, fontSize: 15, fontWeight: '800' },
  tabLabelSelected: { color: colors.textOnNavy },
  tabCount: { color: colors.mutedOnNavy, fontSize: 11, fontWeight: '600', opacity: 0.8 },
  description: { color: colors.mutedOnNavy, fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.md },
  card: {
    width: '48.5%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0E1A3A',
    borderWidth: 1.5,
    borderColor: colors.navyBorder,
  },
  cardPressed: { borderColor: SELECTED, shadowColor: SELECTED, shadowOpacity: 0.9, shadowRadius: 10, elevation: 8 },
  thumbnail: { width: '100%', aspectRatio: 248 / 288, backgroundColor: colors.navy },
  cardBody: { padding: spacing.md, gap: 4 },
  cardTitle: { color: colors.textOnNavy, fontSize: 16, fontWeight: '800' },
  cardDescription: { color: colors.mutedOnNavy, fontSize: 12, lineHeight: 16, minHeight: 32 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tag: {
    color: SELECTED,
    fontSize: 10,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: 'rgba(94, 224, 255, 0.45)',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
