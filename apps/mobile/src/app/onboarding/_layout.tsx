import { Stack } from 'expo-router';

import { colors } from '@/core/theme';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.navy },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="guide" />
      <Stack.Screen name="paywall" options={{ animation: 'slide_from_bottom' }} />
    </Stack>
  );
}
