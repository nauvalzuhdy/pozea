import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { createPoseDetector, type PoseEngine } from 'pozea-pose';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  type CameraRef,
  CommonResolutions,
  useCameraPermission,
  useFrameOutput,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { colors, radius, spacing } from '@/core/theme';
import {
  BONES,
  LANDMARK_COUNT,
  MIN_VISIBILITY,
  countVisible,
  uprightToFrame,
} from '@/features/pose-engine/landmarks';

// The frame worklet reads the engine from a synchronizable, so switching engines does not
// recreate the camera output. Index 0 is ML Kit, 1 is MediaPipe.
const ENGINES: readonly { id: PoseEngine; label: string }[] = [
  { id: 'mlkit', label: 'ML Kit' },
  { id: 'mediapipe', label: 'MediaPipe' },
];

interface Stats {
  fps: number;
  avgMs: number;
  personRate: number;
  visible: number;
}

const EMPTY_STATS: Stats = { fps: 0, avgMs: 0, personRate: 0, visible: 0 };

// Running totals for the current engine. `since` is set when the first result arrives.
const freshTotals = () => ({ frames: 0, withPerson: 0, msSum: 0, visibleSum: 0, since: 0 });

/**
 * Week 1 spike: live camera, pose detection with a switchable engine, and a skeleton overlay.
 * Per-frame data stays in a Reanimated shared value drawn by Skia; React state only holds the
 * stats readout, refreshed twice a second.
 */
export function PoseCamera({ onClose }: { onClose: () => void }) {
  const permission = useCameraPermission();
  if (!permission.hasPermission) {
    return (
      <PermissionPrompt
        canRequest={permission.canRequestPermission}
        onRequest={permission.requestPermission}
        onClose={onClose}
      />
    );
  }
  return <LivePoseCamera onClose={onClose} />;
}

function LivePoseCamera({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [engineIndex, setEngineIndex] = useState(0);
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);

  const detector = useMemo(() => createPoseDetector(), []);
  const engineSync = useMemo(() => createSynchronizable(0, { fixedType: true }), []);
  // Flattened [x, y, visibility] per landmark in preview view coordinates; empty when no person.
  const skeleton = useSharedValue<number[]>([]);
  const running = useRef(freshTotals());

  const selectEngine = (index: number) => {
    engineSync.setDirty(index);
    setEngineIndex(index);
    running.current = freshTotals();
    setStats(EMPTY_STATS);
  };

  // Runs on the JS thread for every processed frame. Camera points are converted here because
  // the preview view's mapping (crop, scale, mirroring) is only available on this thread.
  const onPose = (cameraPoints: number[], inferenceMs: number, fromEngine: number) => {
    if (fromEngine !== engineSync.getDirty()) return;
    const r = running.current;
    if (r.since === 0) r.since = Date.now();
    r.frames++;
    r.msSum += inferenceMs;
    const preview = camera.current;
    if (cameraPoints.length === 0 || preview == null) {
      skeleton.set([]);
      return;
    }
    r.withPerson++;
    r.visibleSum += countVisible(cameraPoints);
    const view = new Array<number>(cameraPoints.length);
    for (let i = 0; i < cameraPoints.length; i += 3) {
      const p = preview.convertCameraPointToViewPoint({
        x: cameraPoints[i],
        y: cameraPoints[i + 1],
      });
      view[i] = p.x;
      view[i + 1] = p.y;
      view[i + 2] = cameraPoints[i + 2];
    }
    skeleton.set(view);
  };

  useEffect(() => {
    const id = setInterval(() => {
      const r = running.current;
      const seconds = (Date.now() - r.since) / 1000;
      if (r.frames < 2 || seconds <= 0) return;
      setStats({
        fps: r.frames / seconds,
        avgMs: r.msSum / r.frames,
        personRate: r.withPerson / r.frames,
        visible: r.withPerson === 0 ? 0 : r.visibleSum / r.withPerson,
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    targetResolution: CommonResolutions.VGA_16_9,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      const index = engineSync.getDirty();
      try {
        const result = detector.detect(frame, index === 1 ? 'mediapipe' : 'mlkit');
        const lm = result.landmarks;
        const points: number[] = [];
        if (lm.length === LANDMARK_COUNT * 3) {
          for (let i = 0; i < lm.length; i += 3) {
            const raw = uprightToFrame(
              lm[i],
              lm[i + 1],
              result.rotationDegrees,
              frame.width,
              frame.height,
            );
            const c = frame.convertFramePointToCameraPoint(raw);
            points.push(c.x, c.y, lm[i + 2]);
          }
        }
        scheduleOnRN(onPose, points, result.inferenceMs, index);
      } catch (e) {
        scheduleOnRN(setError, String(e));
      } finally {
        frame.dispose();
      }
    },
  });

  const bones = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const v = skeleton.get();
    if (v.length > 0) {
      for (const [a, b] of BONES) {
        if (v[a * 3 + 2] < MIN_VISIBILITY || v[b * 3 + 2] < MIN_VISIBILITY) continue;
        path.moveTo(v[a * 3], v[a * 3 + 1]);
        path.lineTo(v[b * 3], v[b * 3 + 1]);
      }
    }
    return path.detach();
  });

  const joints = useDerivedValue(() => {
    const path = Skia.PathBuilder.Make();
    const v = skeleton.get();
    for (let i = 0; i < v.length; i += 3) {
      if (v[i + 2] >= MIN_VISIBILITY) path.addCircle(v[i], v[i + 1], 5);
    }
    return path.detach();
  });

  const engine = ENGINES[engineIndex];

  return (
    <View style={styles.root}>
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={position}
        isActive
        outputs={[frameOutput]}
        resizeMode="cover"
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Canvas style={StyleSheet.absoluteFill}>
          <Path
            path={bones}
            style="stroke"
            strokeWidth={4}
            strokeCap="round"
            color={colors.poseMatch}
          />
          <Path path={joints} color={colors.textOnNavy} />
        </Canvas>
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <RoundButton label="✕" accessibilityLabel="Tutup kamera" onPress={onClose} />
        <View style={styles.segment} accessibilityRole="radiogroup">
          {ENGINES.map((e, i) => (
            <Pressable
              key={e.id}
              onPress={() => selectEngine(i)}
              accessibilityRole="radio"
              accessibilityState={{ selected: i === engineIndex }}
              style={[styles.segmentItem, i === engineIndex && styles.segmentItemSelected]}
            >
              <Text style={styles.segmentLabel}>{e.label}</Text>
            </Pressable>
          ))}
        </View>
        <RoundButton
          label="⟲"
          accessibilityLabel="Ganti kamera depan atau belakang"
          onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}
        />
      </View>

      <View style={[styles.stats, { marginBottom: insets.bottom + spacing.lg }]}>
        <Text style={styles.statsTitle}>{engine.label}</Text>
        <Text style={styles.statsLine}>
          {stats.fps.toFixed(1)} fps · {stats.avgMs.toFixed(0)} ms per frame
        </Text>
        <Text style={styles.statsLine}>
          Orang terdeteksi {(stats.personRate * 100).toFixed(0)}% · titik terlihat{' '}
          {stats.visible.toFixed(0)}/{LANDMARK_COUNT}
        </Text>
        {error != null && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

function PermissionPrompt({
  canRequest,
  onRequest,
  onClose,
}: {
  canRequest: boolean;
  onRequest: () => Promise<boolean>;
  onClose: () => void;
}) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.promptTitle}>Izinkan kamera</Text>
      <Text style={styles.promptBody}>
        Pozea memakai kamera untuk melihat posemu dan memandumu. Pose dideteksi langsung di HP,
        gambar kamera tidak dikirim ke mana pun.
      </Text>
      <Pressable
        style={styles.promptButton}
        accessibilityRole="button"
        onPress={() => (canRequest ? onRequest() : Linking.openSettings())}
      >
        <Text style={styles.promptButtonLabel}>
          {canRequest ? 'Izinkan kamera' : 'Buka Pengaturan'}
        </Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onClose}>
        <Text style={styles.promptBack}>Nanti saja</Text>
      </Pressable>
    </View>
  );
}

function RoundButton({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.round}
    >
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

const glass = 'rgba(11, 21, 48, 0.72)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  round: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundLabel: { color: colors.textOnNavy, fontSize: 20, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: glass, borderRadius: radius.pill, padding: 4 },
  segmentItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  segmentItemSelected: { backgroundColor: colors.blue },
  segmentLabel: { color: colors.textOnNavy, fontSize: 14, fontWeight: '700' },
  stats: {
    position: 'absolute',
    bottom: 0,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: glass,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statsTitle: { color: colors.textOnNavy, fontSize: 15, fontWeight: '800' },
  statsLine: { color: colors.mutedOnNavy, fontSize: 13, fontVariant: ['tabular-nums'] },
  error: { color: colors.poseMismatch, fontSize: 12, marginTop: spacing.xs },
  prompt: {
    flex: 1,
    backgroundColor: colors.navy,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.lg,
  },
  promptTitle: { color: colors.textOnNavy, fontSize: 28, fontWeight: '800' },
  promptBody: { color: colors.mutedOnNavy, fontSize: 16, lineHeight: 24 },
  promptButton: {
    alignItems: 'center',
    backgroundColor: colors.blue,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
  },
  promptButtonLabel: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  promptBack: { color: colors.mutedOnNavy, fontSize: 15, textAlign: 'center' },
});
