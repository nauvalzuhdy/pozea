// Simple typed translations. Usage: `const { t } = useI18n(); t.onboarding.guide.title`.
// Copy lives in en.ts (source of truth for keys) and id.ts; add a section there for each new screen.

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { settings } from '@/core/settings';

import { en, type Messages } from './en';
import { id } from './id';

export type Language = 'en' | 'id';

export const LANGUAGES: readonly { value: Language; label: string; flag: string }[] = [
  { value: 'en', label: 'EN', flag: '🇺🇸' },
  { value: 'id', label: 'ID', flag: '🇮🇩' },
];

const messages: Record<Language, Messages> = { en, id };

/**
 * Phone language, read through Hermes' Intl so no native module (and no new dev build) is
 * needed. Indonesian phones get Indonesian; everything else falls back to English.
 */
export function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    return locale.startsWith('id') || locale.startsWith('in') ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

interface I18n {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Messages;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => settings.language() ?? deviceLanguage());

  const value = useMemo<I18n>(
    () => ({
      language,
      setLanguage: (next) => {
        settings.setLanguage(next);
        setLanguageState(next);
      },
      t: messages[language],
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
