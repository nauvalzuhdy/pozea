import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { colors } from '@/core/theme';

const TRACK = 150;
const KNOB = 22;
export const MIN_OPACITY = 0.1;

/**
 * Vertical slider for the silhouette opacity (10%...100%). Drag or tap the track; `onCommit` runs
 * once when the finger lifts, so the value is saved once instead of on every move.
 */
export function SilhouetteSlider({
  value,
  onChange,
  onCommit,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const [active, setActive] = useState(false);
  const [dragged, setDragged] = useState(value);

  // The children ignore touches, so locationY is always relative to the track.
  const fromY = (y: number) => {
    const t = 1 - Math.min(TRACK, Math.max(0, y)) / TRACK;
    return MIN_OPACITY + t * (1 - MIN_OPACITY);
  };
  const move = (e: GestureResponderEvent) => {
    const next = fromY(e.nativeEvent.locationY);
    setDragged(next);
    onChange(next);
  };
  const end = () => {
    setActive(false);
    onCommit(dragged);
  };

  const knobTop = (1 - (value - MIN_OPACITY) / (1 - MIN_OPACITY)) * TRACK - KNOB / 2;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Kecerahan siluet"
      accessibilityValue={{ min: 10, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        const step = e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1;
        const next = Math.min(1, Math.max(MIN_OPACITY, value + step));
        onChange(next);
        onCommit(next);
      }}
    >
      <Ionicons name="sunny" size={20} color={colors.textOnNavy} />
      <View
        style={styles.track}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e) => {
          setActive(true);
          move(e);
        }}
        onResponderMove={move}
        onResponderRelease={end}
        onResponderTerminate={end}
      >
        <View style={styles.rail} pointerEvents="none" />
        <View
          style={[styles.fill, { top: knobTop + KNOB / 2 }]}
          pointerEvents="none"
        />
        <View style={[styles.knob, { top: knobTop }, active && styles.knobActive]} pointerEvents="none" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    width: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11, 21, 48, 0.55)',
  },
  track: { width: 40, height: TRACK, alignItems: 'center' },
  rail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  fill: { position: 'absolute', bottom: 0, width: 3, borderRadius: 2, backgroundColor: '#FFFFFF' },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    backgroundColor: '#FFFFFF',
  },
  knobActive: { transform: [{ scale: 1.2 }] },
});
