import { Body, PrimaryButton, Screen, Title } from '@/core/ui';

export default function HomeScreen() {
  return (
    <Screen>
      <Title>Fotografer pribadimu, selalu ada di sakumu.</Title>
      <Body>Pilih jenis foto, tempat, dan ukuran. Pozea memandumu sampai posenya pas.</Body>
      <PrimaryButton label="Mulai foto" href="/setup" />
      <PrimaryButton
        label="Kamera pose"
        href={{ pathname: '/camera/[poseId]', params: { poseId: 'peace-sign' } }}
      />
      <PrimaryButton label="Pengaturan" href="/settings" />
    </Screen>
  );
}
