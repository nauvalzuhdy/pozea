import { useRouter } from 'expo-router';

import { PoseCamera } from '@/features/camera/PoseCamera';

// Week 1: live camera with the skeleton overlay and the engine comparison.
// Week 2 adds the target pose from `poseId`, scoring by src/features/pose-engine, and auto capture.
export default function CameraScreen() {
  const router = useRouter();
  return <PoseCamera onClose={() => router.back()} />;
}
