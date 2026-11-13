import { useLocalSearchParams, useRouter } from 'expo-router';

import { PoseCamera } from '@/features/camera/PoseCamera';

export default function CameraScreen() {
  const router = useRouter();
  const { poseId } = useLocalSearchParams<{ poseId: string }>();
  return <PoseCamera initialPose={poseId} onClose={() => router.back()} />;
}
