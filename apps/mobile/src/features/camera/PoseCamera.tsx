import { Ionicons } from '@expo/vector-icons';
import { BlurMask, Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { createPoseDetector } from 'pozea-pose';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  interpolateColor,
  type SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  type CameraRef,
  CommonResolutions,
  type FlashMode,
  useCameraPermission,
  useFrameOutput,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { createSynchronizable, scheduleOnRN } from 'react-native-worklets';

import { settings } from '@/core/settings';
import { colors } from '@/core/theme';
import { cachedPhrases, refreshPhrases } from '@/features/cues/phraseCache';
import { cueText } from '@/features/cues/phrases';
import { affineFromPoints, mapPoints, type Affine } from '@/features/pose-engine/affine';
import { maskContour } from '@/features/pose-engine/contour';
import { detectCues, INITIAL_CUE, nextCue, type CueCode } from '@/features/pose-engine/cues';
import { toPixels } from '@/features/pose-engine/geometry';
import { BONES, LANDMARK_COUNT, MIN_VISIBILITY, uprightToFrame } from '@/features/pose-engine/landmarks';
import { INITIAL_MATCHER, stepMatcher } from '@/features/pose-engine/matcher';
import { scorePose } from '@/features/pose-engine/score';
import { jointAngles } from '@/features/pose-engine/template';
import { findPose, POSES, type Pose } from '@/features/poses/catalog';

import { cropAndSave, type ViewGeometry } from './capture';
import { cropRect, fitSilhouette, RATIOS, type RatioId } from './layout';
import { PoseStrip } from './PoseStrip';
import { SilhouetteSlider } from './SilhouetteSlider';

const RED = colors.poseMismatch;
const GREEN = colors.green;

/** At most ~15 analyses per second: enough for guidance, and the phone stays cool. */
const MIN_FRAME_INTERVAL_MS = 66;
/** A body outline older than this (no new mask) is no longer drawn. */
const CONTOUR_STALE_MS = 600;
const TIMERS = [0, 3, 5, 10] as const;
const FLASH_MODES: readonly FlashMode[] = ['off', 'on', 'auto'];
const FLASH_ICONS = { off: 'flash-off', on: 'flash', auto: 'flash-outline' } as const;

const TOP_BAR = 60;
const CONTROLS = 84;
const STRIP = 90;

/** What the frame worklet sends to the JS thread for every analyzed frame. */
interface FrameResult {
  /** 33 x [u, v, visibility], normalized to the upright image; empty when nobody is seen. */
  landmarks: number[];
  /** Camera points of the upright image corners (0,0), (1,0), (0,1), for the view mapping. */
  basis: number[];
  aspect: number;
  face: [number, number, number] | null;
  mask: number[];
  maskWidth: number;
  maskHeight: number;
  inferenceMs: number;
}

/**
 * Pose camera: live guidance into the chosen pose, then an automatic photo once it holds.
 * Per-frame data lives in Reanimated shared values drawn by Skia; React state only holds the
 * instruction, the matched flag, and the score chip (updated a few times a second).
 */
export function PoseCamera({ initialPose, onClose }: { initialPose?: string; onClose: () => void }) {
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
  return <LivePoseCamera initialPose={initialPose} onClose={onClose} />;
}

function LivePoseCamera({ initialPose, onClose }: { initialPose?: string; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraRef>(null);

  const [pose, setPose] = useState<Pose>(() => findPose(initialPose));
  const [position, setPosition] = useState<'back' | 'front'>('back');
  const [ratio, setRatio] = useState<RatioId>('3:4');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(0);
  const [opacity, setOpacity] = useState(() => settings.silhouetteOpacity());
  const [variations, setVariations] = useState(() => cachedPhrases(findPose(initialPose).slug));
  const [cue, setCue] = useState<{ code: CueCode; pick: number }>({ code: 'FULL_BODY', pick: 0 });
  const [matched, setMatched] = useState(false);
  const [percent, setPercent] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [lastPhoto, setLastPhoto] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ width: 0, height: 0 });
  const [stats, setStats] = useState<{ fps: number; ms: number } | null>(null);
  const [engine] = useState(() => settings.poseEngine());
  const [showStats] = useState(() => settings.showStats());

  const detector = useMemo(() => createPoseDetector(), []);
  const lastFrameAt = useMemo(() => createSynchronizable(0, { fixedType: true }), []);
  const withFace = useMemo(() => createSynchronizable(true, { fixedType: true }), []);

  // Per-frame values for the UI thread.
  const skeleton = useSharedValue<number[]>([]);
  const contour = useSharedValue<number[]>([]);
  const score = useSharedValue(0);
  const hold = useSharedValue(0);
  const matchedFlag = useSharedValue(0);
  const pulse = useSharedValue(0);
  const flashOverlay = useSharedValue(0);

  // Mutable state the frame callback reads; refs, so the callback never sees stale values.
  const poseRef = useRef(pose);
  const matcher = useRef(INITIAL_MATCHER);
  const cueState = useRef(INITIAL_CUE);
  const matchedRef = useRef(false);
  const chip = useRef({ value: 0, at: 0 });
  const contourAt = useRef(0);
  const capturing = useRef(false);
  const geometry = useRef<ViewGeometry | null>(null);
  const captureSettings = useRef({ flash, position });
  const totals = useRef({ frames: 0, ms: 0, since: 0 });

  const crop = cropRect(
    view.width,
    insets.top + TOP_BAR,
    view.height - (insets.bottom + STRIP + CONTROLS + 16),
    RATIOS.find((r) => r.id === ratio)!.value,
  );

  useEffect(() => {
    poseRef.current = pose;
    withFace.setDirty(pose.template.face !== null);
  }, [pose, withFace]);
  useEffect(() => {
    captureSettings.current = { flash, position };
  }, [flash, position]);
  useEffect(() => {
    geometry.current = view.width > 0 ? { width: view.width, height: view.height, crop } : null;
  });
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 900 }), -1, true));
  }, [pulse]);

  // Fetch fresh phrase variations in the background; the cached ones are already shown.
  useEffect(() => {
    let alive = true;
    refreshPhrases(pose.slug, pose.title).then((fresh) => {
      if (alive && fresh) setVariations(fresh);
    });
    return () => {
      alive = false;
    };
  }, [pose]);

  useEffect(() => {
    if (!showStats) return;
    const id = setInterval(() => {
      const t = totals.current;
      const seconds = (Date.now() - t.since) / 1000;
      if (t.frames < 2 || seconds <= 0) return;
      setStats({ fps: t.frames / seconds, ms: t.ms / t.frames });
      totals.current = { frames: 0, ms: 0, since: Date.now() };
    }, 1000);
    return () => clearInterval(id);
  }, [showStats]);

  const photoOutput = usePhotoOutput({
    // Same 16:9 framing as the preview stream, so the brackets crop what the user saw.
    targetResolution: CommonResolutions.UHD_16_9,
    qualityPrioritization: 'balanced',
  });

  const takePhoto = async () => {
    if (capturing.current) return;
    const g = geometry.current;
    if (!g) return;
    capturing.current = true;
    flashOverlay.set(withSequence(withTiming(0.9, { duration: 60 }), withTiming(0, { duration: 280 })));
    try {
      const { flash: mode, position: side } = captureSettings.current;
      const file = await photoOutput.capturePhotoToFile({ flashMode: side === 'back' ? mode : 'off' }, {});
      setLastPhoto(await cropAndSave(file.filePath, g));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      capturing.current = false;
    }
  };

  const selectPose = (next: Pose) => {
    if (next.slug === pose.slug) return;
    poseRef.current = next;
    matcher.current = INITIAL_MATCHER;
    cueState.current = INITIAL_CUE;
    matchedRef.current = false;
    setPose(next);
    setVariations(cachedPhrases(next.slug));
    setMatched(false);
    setCue({ code: 'FULL_BODY', pick: 0 });
  };

  // Runs on the JS thread for every analyzed frame.
  const onPose = (f: FrameResult) => {
    const now = Date.now();
    const current = poseRef.current;
    const t = totals.current;
    if (t.since === 0) t.since = now;
    t.frames++;
    t.ms += f.inferenceMs;

    // Map upright image coordinates to the preview view (rotation, mirroring, cover crop).
    let m: Affine | null = null;
    const preview = camera.current;
    if (preview) {
      try {
        const p = [0, 2, 4].map((i) => preview.convertCameraPointToViewPoint({ x: f.basis[i], y: f.basis[i + 1] }));
        m = affineFromPoints(p[0], p[1], p[2]);
      } catch {
        m = null;
      }
    }

    const seen = f.landmarks.length === LANDMARK_COUNT * 3;
    const pixels = seen ? toPixels(f.landmarks, f.aspect * 1000, 1000) : [];
    const angles = seen ? jointAngles(pixels) : {};
    const raw = seen ? scorePose(angles, current.template) : 0;
    const step = stepMatcher(matcher.current, raw, now, current.match);
    matcher.current = step.state;

    skeleton.set(m && seen ? mapPoints(m, f.landmarks, 3) : []);
    if (m && f.mask.length > 0) {
      const outline = maskContour(f.mask, f.maskWidth, f.maskHeight);
      contour.set(outline.length > 0 ? mapPoints(m, outline, 2) : []);
      contourAt.current = now;
    } else if (!seen || now - contourAt.current > CONTOUR_STALE_MS) {
      contour.set([]);
    }
    score.set(step.state.smoothed);
    hold.set(step.holdProgress);
    matchedFlag.set(step.state.matched ? 1 : 0);

    const face = f.face ? { smile: f.face[0] < 0 ? 1 : f.face[0], pitch: f.face[1], yaw: f.face[2] } : null;
    const candidates = detectCues({ landmarks: pixels, frameWidth: f.aspect * 1000, frameHeight: 1000, face, angles }, current.template, current.match);
    const next = nextCue(cueState.current, candidates, step.state.matched, now);
    if (next !== cueState.current) {
      cueState.current = next;
      setCue({ code: next.code ?? 'FULL_BODY', pick: Math.random() });
    }

    if (step.state.matched !== matchedRef.current) {
      matchedRef.current = step.state.matched;
      setMatched(step.state.matched);
      if (step.justMatched) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    const pct = Math.round(step.state.smoothed * 100);
    if (pct !== chip.current.value && now - chip.current.at > 250) {
      chip.current = { value: pct, at: now };
      setPercent(pct);
    }
    if (step.capture) void takePhoto();
  };

  const frameOutput = useFrameOutput({
    pixelFormat: 'yuv',
    targetResolution: CommonResolutions.VGA_16_9,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      'worklet';
      const now = Date.now();
      if (now - lastFrameAt.getDirty() < MIN_FRAME_INTERVAL_MS) {
        frame.dispose();
        return;
      }
      lastFrameAt.setDirty(now);
      try {
        const r = detector.detect(frame, { engine, withFace: withFace.getDirty(), withMask: true });
        const basis: number[] = [];
        const corners = [0, 0, 1, 0, 0, 1];
        for (let i = 0; i < 6; i += 2) {
          const raw = uprightToFrame(corners[i], corners[i + 1], r.rotationDegrees, frame.width, frame.height);
          const c = frame.convertFramePointToCameraPoint(raw);
          basis.push(c.x, c.y);
        }
        const result: FrameResult = {
          landmarks: r.landmarks,
          basis,
          aspect: r.uprightAspect,
          face: r.hasFace ? [r.smile, r.pitch, r.yaw] : null,
          mask: r.mask,
          maskWidth: r.maskWidth,
          maskHeight: r.maskHeight,
          inferenceMs: r.inferenceMs,
        };
        scheduleOnRN(onPose, result);
      } catch (e) {
        scheduleOnRN(setError, String(e));
      } finally {
        frame.dispose();
      }
    },
  });

  // Body line: the segmentation outline when there is one, else a thick band along the bones.
  const bodyPath = useDerivedValue(() => {
    const b = Skia.PathBuilder.Make();
    const c = contour.get();
    if (c.length >= 6) {
      b.moveTo(c[0], c[1]);
      for (let i = 2; i < c.length; i += 2) b.lineTo(c[i], c[i + 1]);
      b.close();
      return b.detach();
    }
    const v = skeleton.get();
    if (v.length > 0) {
      for (const [p, q] of BONES) {
        if (v[p * 3 + 2] < MIN_VISIBILITY || v[q * 3 + 2] < MIN_VISIBILITY) continue;
        b.moveTo(v[p * 3], v[p * 3 + 1]);
        b.lineTo(v[q * 3], v[q * 3 + 1]);
      }
    }
    return b.detach();
  });
  const lineWidth = useDerivedValue(() => (contour.get().length >= 6 ? 4 : 18));
  const glowWidth = useDerivedValue(() => (contour.get().length >= 6 ? 10 : 30));
  const lineColor = useDerivedValue(() =>
    matchedFlag.get() === 1 ? GREEN : interpolateColor(score.get(), [0.5, 0.85], [RED, GREEN]),
  );
  const glowStyle = useAnimatedStyle(() => {
    const near = Math.min(1, Math.max(0, (score.get() - 0.5) / 0.35));
    return { opacity: matchedFlag.get() === 1 ? 0.6 + 0.4 * pulse.get() : near * 0.35 };
  });
  const flashStyle = useAnimatedStyle(() => ({ opacity: flashOverlay.get() }));

  const silhouetteAsset = Image.resolveAssetSource(pose.silhouette);
  const silhouetteAspect = {
    width: silhouetteAsset?.width || 1,
    height: silhouetteAsset?.height || 2,
  };
  const bubbleSpace = 84;
  const target = fitSilhouette(
    { x: crop.x, y: crop.y + bubbleSpace, width: crop.width, height: Math.max(0, crop.height - bubbleSpace - 56) },
    silhouetteAspect.width,
    silhouetteAspect.height,
    0.98,
  );
  const text = cueText(cue.code, pose.cues, variations, cue.pick);

  const onShutter = () => {
    if (countdown !== null) return;
    if (timer === 0) {
      void takePhoto();
      return;
    }
    setCountdown(timer);
    let left: number = timer;
    const id = setInterval(() => {
      left--;
      if (left <= 0) {
        clearInterval(id);
        setCountdown(null);
        void takePhoto();
      } else {
        setCountdown(left);
      }
    }, 1000);
  };

  return (
    <View
      style={styles.root}
      onLayout={(e: LayoutChangeEvent) =>
        setView({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })
      }
    >
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={position}
        isActive
        outputs={[frameOutput, photoOutput]}
        resizeMode="cover"
      />

      {/* Target silhouette: always white; the slider sets how strongly it shows. */}
      {view.width > 0 && (
        <Image
          source={pose.silhouette}
          style={[styles.silhouette, { left: target.x, top: target.y, width: target.width, height: target.height, opacity }]}
          resizeMode="contain"
          pointerEvents="none"
        />
      )}

      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Group>
          <Path path={bodyPath} style="stroke" strokeWidth={glowWidth} strokeJoin="round" strokeCap="round" color={lineColor} opacity={0.45}>
            <BlurMask blur={8} style="normal" />
          </Path>
          <Path path={bodyPath} style="stroke" strokeWidth={lineWidth} strokeJoin="round" strokeCap="round" color={lineColor} />
        </Group>
      </Canvas>

      <CropBrackets rect={crop} />

      {/* Outer frame: thin navy at rest, glowing green while the pose matches. */}
      <View style={[styles.frame, styles.frameIdle]} pointerEvents="none" />
      <Animated.View style={[styles.frame, styles.frameGlow, glowStyle]} pointerEvents="none" />

      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <RoundButton icon="close" label="Tutup kamera" onPress={onClose} />
        <View style={styles.posePill}>
          <Text style={styles.posePillText} numberOfLines={1}>
            {pose.title}
          </Text>
        </View>
        <View style={styles.topActions}>
          <RoundButton
            icon={FLASH_ICONS[flash as keyof typeof FLASH_ICONS]}
            label={`Flash ${flash === 'off' ? 'mati' : flash === 'on' ? 'nyala' : 'otomatis'}`}
            onPress={() => setFlash(FLASH_MODES[(FLASH_MODES.indexOf(flash) + 1) % FLASH_MODES.length])}
          />
          <RoundButton
            text={ratio}
            label={`Rasio foto ${ratio}`}
            onPress={() => setRatio(RATIOS[(RATIOS.findIndex((r) => r.id === ratio) + 1) % RATIOS.length].id)}
          />
          <RoundButton
            icon={timer === 0 ? 'timer-outline' : undefined}
            text={timer === 0 ? undefined : `${timer}s`}
            label={timer === 0 ? 'Timer mati' : `Timer ${timer} detik`}
            onPress={() => setTimer(TIMERS[(TIMERS.indexOf(timer) + 1) % TIMERS.length])}
          />
        </View>
      </View>

      {/* Live instruction: one message from what is detected right now. */}
      <View
        style={[styles.bubble, { top: crop.y + 12, left: crop.x + 12, right: view.width - crop.x - crop.width + 12 }]}
        accessibilityLiveRegion="polite"
      >
        <View style={[styles.bubbleIcon, { backgroundColor: matched ? GREEN : RED }]}>
          <Ionicons name={matched ? 'checkmark' : 'alert'} size={16} color="#FFFFFF" />
        </View>
        <View style={styles.bubbleText}>
          <Text style={styles.bubbleTitle} numberOfLines={1}>
            {text.title}
          </Text>
          <Text style={styles.bubbleDetail} numberOfLines={1}>
            {text.detail}
          </Text>
        </View>
        <View style={[styles.chip, { backgroundColor: matched ? GREEN : 'rgba(255, 77, 77, 0.9)' }]}>
          <Text style={styles.chipText}>{percent}%</Text>
        </View>
      </View>

      <View style={[styles.slider, { top: crop.y + crop.height / 2 - 100, right: view.width - crop.x - crop.width + 8 }]}>
        <SilhouetteSlider value={opacity} onChange={setOpacity} onCommit={settings.setSilhouetteOpacity} />
      </View>

      <View style={[styles.statusRow, { top: crop.y + crop.height - 48 }]} pointerEvents="none">
        <View style={[styles.statusPill, { backgroundColor: matched ? GREEN : RED }]}>
          <Text style={styles.statusText}>{matched ? 'Cocok! Tahan…' : 'Belum pas'}</Text>
        </View>
        {error != null && (
          <Text style={styles.error} numberOfLines={2}>
            {error}
          </Text>
        )}
        {stats != null && (
          <Text style={styles.stats}>
            {engine} · {stats.fps.toFixed(1)} fps · {stats.ms.toFixed(0)} ms
          </Text>
        )}
      </View>

      <View style={[styles.controls, { bottom: insets.bottom + STRIP + 8 }]}>
        <View style={styles.gallery} accessibilityLabel="Foto terakhir">
          {lastPhoto != null && <Image source={{ uri: lastPhoto }} style={styles.galleryImage} />}
        </View>
        <Pressable onPress={onShutter} accessibilityRole="button" accessibilityLabel="Ambil foto" style={styles.shutter}>
          <Canvas style={StyleSheet.absoluteFill}>
            <ShutterRing progress={hold} />
          </Canvas>
          <View style={styles.shutterInner}>
            {countdown != null && <Text style={styles.countdown}>{countdown}</Text>}
          </View>
        </Pressable>
        <RoundButton
          icon="camera-reverse-outline"
          label="Ganti kamera depan atau belakang"
          size={52}
          onPress={() => setPosition((p) => (p === 'back' ? 'front' : 'back'))}
        />
      </View>

      <View style={[styles.strip, { bottom: insets.bottom + 4 }]}>
        <PoseStrip poses={POSES} selected={pose.slug} onSelect={selectPose} />
      </View>

      <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} pointerEvents="none" />
    </View>
  );
}

const RING_SIZE = 84;
const ringPath = (() => {
  const b = Skia.PathBuilder.Make();
  b.addCircle(RING_SIZE / 2, RING_SIZE / 2, RING_SIZE / 2 - 4);
  return b.detach();
})();

/** Green countdown ring around the shutter while a matched pose is held. */
function ShutterRing({ progress }: { progress: SharedValue<number> }) {
  return (
    <Group transform={[{ rotate: -Math.PI / 2 }]} origin={{ x: RING_SIZE / 2, y: RING_SIZE / 2 }}>
      <Path path={ringPath} style="stroke" strokeWidth={4} color="rgba(255,255,255,0.85)" />
      <Path path={ringPath} style="stroke" strokeWidth={6} strokeCap="round" color={GREEN} start={0} end={progress} />
    </Group>
  );
}

function CropBrackets({ rect }: { rect: { x: number; y: number; width: number; height: number } }) {
  if (rect.width <= 0) return null;
  const size = 28;
  const corners = [
    { left: rect.x, top: rect.y, borderLeftWidth: 3, borderTopWidth: 3, borderTopLeftRadius: 10 },
    { left: rect.x + rect.width - size, top: rect.y, borderRightWidth: 3, borderTopWidth: 3, borderTopRightRadius: 10 },
    { left: rect.x, top: rect.y + rect.height - size, borderLeftWidth: 3, borderBottomWidth: 3, borderBottomLeftRadius: 10 },
    {
      left: rect.x + rect.width - size,
      top: rect.y + rect.height - size,
      borderRightWidth: 3,
      borderBottomWidth: 3,
      borderBottomRightRadius: 10,
    },
  ];
  return (
    <>
      {corners.map((c, i) => (
        <View key={i} style={[styles.bracket, { width: size, height: size }, c]} pointerEvents="none" />
      ))}
    </>
  );
}

function RoundButton({
  icon,
  text,
  label,
  size = 40,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  text?: string;
  label: string;
  size?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}
    >
      {icon ? <Ionicons name={icon} size={size * 0.5} color="#FFFFFF" /> : <Text style={styles.roundText}>{text}</Text>}
    </Pressable>
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
        Pozea memakai kamera untuk melihat posemu dan memandumu. Pose dideteksi langsung di HP, gambar
        kamera tidak dikirim ke mana pun.
      </Text>
      <Pressable
        style={styles.promptButton}
        accessibilityRole="button"
        onPress={() => (canRequest ? onRequest() : Linking.openSettings())}
      >
        <Text style={styles.promptButtonLabel}>{canRequest ? 'Izinkan kamera' : 'Buka Pengaturan'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onClose}>
        <Text style={styles.promptBack}>Nanti saja</Text>
      </Pressable>
    </View>
  );
}

const glass = 'rgba(11, 21, 48, 0.62)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  silhouette: { position: 'absolute' },
  bracket: { position: 'absolute', borderColor: '#FFFFFF' },
  frame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 28 },
  frameIdle: { borderWidth: 2, borderColor: 'rgba(46, 59, 102, 0.8)' },
  frameGlow: {
    borderWidth: 6,
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOpacity: 1,
    shadowRadius: 18,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  topActions: { flexDirection: 'row', gap: 8 },
  posePill: {
    flexShrink: 1,
    backgroundColor: glass,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  posePillText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  round: { backgroundColor: glass, alignItems: 'center', justifyContent: 'center' },
  roundText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  bubble: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(11, 21, 48, 0.78)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bubbleIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bubbleText: { flex: 1 },
  bubbleTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  bubbleDetail: { color: colors.mutedOnNavy, fontSize: 12, marginTop: 1 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', fontVariant: ['tabular-nums'] },
  slider: { position: 'absolute' },
  statusRow: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  statusText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  error: { color: '#FFFFFF', backgroundColor: 'rgba(255,77,77,0.85)', fontSize: 11, paddingHorizontal: 8, borderRadius: 6 },
  stats: { color: '#FFFFFF', backgroundColor: glass, fontSize: 11, paddingHorizontal: 8, borderRadius: 6 },
  controls: {
    position: 'absolute',
    left: 28,
    right: 28,
    height: CONTROLS,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gallery: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: glass,
    overflow: 'hidden',
  },
  galleryImage: { width: '100%', height: '100%' },
  shutter: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  shutterInner: {
    width: RING_SIZE - 20,
    height: RING_SIZE - 20,
    borderRadius: (RING_SIZE - 20) / 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: { color: colors.navy, fontSize: 26, fontWeight: '900' },
  strip: { position: 'absolute', left: 0, right: 0, height: STRIP },
  flash: { backgroundColor: '#FFFFFF' },
  prompt: { flex: 1, backgroundColor: colors.navy, justifyContent: 'center', padding: 24, gap: 16 },
  promptTitle: { color: colors.textOnNavy, fontSize: 28, fontWeight: '800' },
  promptBody: { color: colors.mutedOnNavy, fontSize: 16, lineHeight: 24 },
  promptButton: { alignItems: 'center', backgroundColor: colors.blue, borderRadius: 999, paddingVertical: 16 },
  promptButtonLabel: { color: colors.textOnNavy, fontSize: 16, fontWeight: '700' },
  promptBack: { color: colors.mutedOnNavy, fontSize: 15, textAlign: 'center' },
});
