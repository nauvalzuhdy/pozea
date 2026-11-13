import { useState } from 'react';
import { View } from 'react-native';

import { settings, type PoseEngineSetting } from '@/core/settings';
import { Body, Chip, Screen, Title } from '@/core/ui';

// Phase 2 adds account, privacy policy link, and in-app account deletion (required by Google Play).
export default function SettingsScreen() {
  const [engine, setEngine] = useState(() => settings.poseEngine());
  const [showStats, setShowStats] = useState(() => settings.showStats());

  const pickEngine = (value: PoseEngineSetting) => {
    settings.setPoseEngine(value);
    setEngine(value);
  };
  const toggleStats = (value: boolean) => {
    settings.setShowStats(value);
    setShowStats(value);
  };

  return (
    <Screen>
      <Title>Pengaturan</Title>
      <Body>Akun dan privasi akan tersedia setelah login ditambahkan.</Body>

      <Title>Developer</Title>
      <Body>Mesin deteksi pose untuk kamera. Berlaku saat kamera dibuka lagi.</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="MediaPipe" selected={engine === 'mediapipe'} onPress={() => pickEngine('mediapipe')} />
        <Chip label="ML Kit" selected={engine === 'mlkit'} onPress={() => pickEngine('mlkit')} />
      </View>
      <Body>Tampilkan fps dan waktu model di kamera.</Body>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Tampilkan" selected={showStats} onPress={() => toggleStats(true)} />
        <Chip label="Sembunyikan" selected={!showStats} onPress={() => toggleStats(false)} />
      </View>
    </Screen>
  );
}
