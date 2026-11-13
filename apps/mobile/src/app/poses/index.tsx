import { useLocalSearchParams } from 'expo-router';

import { Body, Screen, Title } from '@/core/ui';

// Phase 1: read the pose catalog from the local SQLite copy (src/data), filtered by these params.
export default function PoseListScreen() {
  const { type, place, ratio } = useLocalSearchParams<{
    type?: string;
    place?: string;
    ratio?: string;
  }>();

  return (
    <Screen>
      <Title>Pose untuk {type ?? 'semua'}</Title>
      <Body>
        Filter: {type ?? '-'}, {place ?? '-'}, {ratio ?? '-'}
      </Body>
      <Body>Katalog pose belum tersambung.</Body>
    </Screen>
  );
}
