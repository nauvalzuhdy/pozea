import { Body, PrimaryButton, Screen, Title } from '@/core/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <Title>Fotografer pribadimu, selalu ada di sakumu.</Title>
      <Body>Pilih jenis foto, tempat, dan ukuran. Pozea memandumu sampai posenya pas.</Body>
      <PrimaryButton label="Mulai foto" href="/setup" />
      <PrimaryButton label="Pilih pose" href="/poses" />
      <PrimaryButton label="Pengaturan" href="/settings" />
    </Screen>
  );
}
