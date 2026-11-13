import { useLocalSearchParams } from 'expo-router';

import { Body, PrimaryButton, Screen, Title } from '@/core/ui';

// Phase 1: show the pose thumbnail and example video from R2.
export default function PoseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <Screen>
      <Title>Pose {id}</Title>
      <Body>Contoh pose belum tersedia.</Body>
      <PrimaryButton label="Coba pose ini" href={{ pathname: '/camera/[poseId]', params: { poseId: id } }} />
    </Screen>
  );
}
