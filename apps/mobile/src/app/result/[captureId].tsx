import { useLocalSearchParams } from 'expo-router';

import { Body, PrimaryButton, Screen, Title } from '@/core/ui';

export default function ResultScreen() {
  const { captureId } = useLocalSearchParams<{ captureId: string }>();

  return (
    <Screen>
      <Title>Foto tersimpan</Title>
      <Body>Foto {captureId} ada di galeri HP-mu.</Body>
      <PrimaryButton label="Foto lagi" href="/setup" />
    </Screen>
  );
}
