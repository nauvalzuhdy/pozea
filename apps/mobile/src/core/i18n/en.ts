// English copy. This file defines the shape every language must match (see `Messages`).
// Group strings by screen or feature so other parts of the app can add their own sections.

export const en = {
  common: {
    skip: 'Skip',
    next: 'Next',
    close: 'Close',
    comingSoon: 'Coming soon',
    language: 'Language',
  },
  onboarding: {
    welcome: {
      eyebrow: 'WELCOME TO POZEA',
      titleStart: 'Never wonder ',
      titleAccent: 'how to pose.',
      body: (count: number) =>
        `${count} poses for selfies and full-body shots, each shown on a faceless figure so you can copy it at a glance.`,
      cta: 'Get started',
    },
    guide: {
      badge: 'LIVE POSE GUIDE',
      title: 'Follow the lines, nail every pose',
      body: 'Guides show up live on your camera. Line up your body and say goodbye to awkward photos.',
      cta: 'Next',
    },
  },
  paywall: {
    heroOverline: 'Pozea PRO',
    heroTitle: 'Unlimited',
    heroSubtitle: 'every premium feature',
    tagline: 'Your best photos start here.',
    choosePlan: 'Choose your plan',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: (percent: number) => `Save ${percent}%`,
    joinPro: 'Join Pozea Pro',
    features: {
      poses: 'More premium styles and poses, always growing',
      editing: 'Full editing suite: filters, retouch, crop and lighting',
      hd: 'Ultra HD quality, save photos in full resolution',
    },
    cancelAnytime: (store: string) => `Cancel anytime on ${store}.`,
    cta: 'Start Your Photo Journey',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    restore: 'Restore Purchase',
    restoreNone: 'No purchases to restore yet.',
  },
};

type Widen<T> = T extends (...args: infer A) => infer R
  ? (...args: A) => R
  : T extends string
    ? string
    : { [K in keyof T]: Widen<T[K]> };

/** Every language file must provide exactly these keys. */
export type Messages = Widen<typeof en>;
