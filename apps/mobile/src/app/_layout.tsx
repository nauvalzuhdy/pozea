import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/core/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.navy },
          headerTintColor: colors.textOnNavy,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.navy },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Pozea' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="setup" options={{ title: 'Mau foto apa?' }} />
        <Stack.Screen name="poses/index" options={{ title: 'Pilih pose' }} />
        <Stack.Screen name="poses/[id]" options={{ title: 'Detail pose' }} />
        <Stack.Screen name="camera/[poseId]" options={{ headerShown: false }} />
        <Stack.Screen name="result/[captureId]" options={{ title: 'Hasil' }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack>
    </>
  );
}
