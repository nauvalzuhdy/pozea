import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { I18nProvider } from '@/core/i18n';
import { colors } from '@/core/theme';
import { OnboardingProvider, useOnboarding } from '@/features/onboarding/state';

export default function RootLayout() {
  return (
    <I18nProvider>
      <OnboardingProvider>
        <StatusBar style="light" />
        <RootStack />
      </OnboardingProvider>
    </I18nProvider>
  );
}

/** New users only see onboarding; once it is finished or skipped, the rest of the app opens. */
function RootStack() {
  const { done } = useOnboarding();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.navy },
      }}
    >
      <Stack.Protected guard={!done}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={done}>
        <Stack.Screen name="index" options={{ title: 'Pozea' }} />
        <Stack.Screen name="setup" options={{ title: 'Mau foto apa?' }} />
        <Stack.Screen name="poses/index" options={{ title: 'Pilih pose' }} />
        <Stack.Screen name="poses/[id]" options={{ title: 'Detail pose' }} />
        <Stack.Screen name="camera/[poseId]" options={{ headerShown: false }} />
        <Stack.Screen name="result/[captureId]" options={{ title: 'Hasil' }} />
        <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
      </Stack.Protected>
    </Stack>
  );
}
