// First-run state. The root layout reads `done` to guard routes (Stack.Protected), so calling
// `finish()` swaps the onboarding stack for Home without a manual navigation.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { settings } from '@/core/settings';

interface OnboardingState {
  done: boolean;
  finish: () => void;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [done, setDone] = useState(() => settings.onboardingDone());
  const value = useMemo<OnboardingState>(
    () => ({
      done,
      finish: () => {
        settings.setOnboardingDone(true);
        setDone(true);
      },
    }),
    [done],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside <OnboardingProvider>');
  return ctx;
}
