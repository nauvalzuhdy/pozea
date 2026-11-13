import { Image, Pressable, ScrollView, StyleSheet } from 'react-native';

import type { Pose } from '@/features/poses/catalog';

export const SELECTED_COLOR = '#5EE0FF';

/** Horizontal strip of pose cards under the shutter; tapping one swaps the target at once. */
export function PoseStrip({
  poses,
  selected,
  onSelect,
}: {
  poses: readonly Pose[];
  selected: string;
  onSelect: (pose: Pose) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      accessibilityRole="radiogroup"
    >
      {poses.map((pose) => {
        const isSelected = pose.slug === selected;
        return (
          <Pressable
            key={pose.slug}
            onPress={() => onSelect(pose)}
            accessibilityRole="radio"
            accessibilityLabel={pose.title}
            accessibilityState={{ selected: isSelected }}
            style={[styles.card, isSelected && styles.cardSelected]}
          >
            <Image source={pose.thumbnail} style={styles.image} resizeMode="cover" />
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingHorizontal: 16, paddingVertical: 6 },
  card: {
    width: 62,
    height: 74,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0B1530',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  cardSelected: {
    borderColor: SELECTED_COLOR,
    shadowColor: SELECTED_COLOR,
    shadowOpacity: 0.9,
    shadowRadius: 10,
    elevation: 10,
  },
  image: { width: '100%', height: '100%' },
});
