import { Body, PrimaryButton, Screen, Title } from '@/core/ui';

// Phase 1: request camera permission here (VisionCamera) before the first camera session.
export default function OnboardingScreen() {
  return (
    <Screen>
      <Title>Pozea butuh akses kamera</Title>
      <Body>
        Kamera dipakai untuk membaca posemu secara langsung di HP. Foto dan wajahmu tidak dikirim
        ke server.
      </Body>
      <PrimaryButton label="Lanjut" href="/" />
    </Screen>
  );
}
