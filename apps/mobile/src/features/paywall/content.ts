import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

import type { Messages } from '@/core/i18n/en';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** PRO features in display order; text comes from `t.paywall.features[key]`. */
export const PRO_FEATURES: readonly { key: keyof Messages['paywall']['features']; icon: IconName }[] = [
  { key: 'poses', icon: 'creation' },
  { key: 'editing', icon: 'tune-variant' },
  { key: 'hd', icon: 'high-definition-box' },
];

/**
 * Legal pages linked under the paywall. Undefined until the pages are published; the links
 * then show a "coming soon" note. Both stores require these before a subscription goes live.
 */
export const LEGAL_URLS: { privacy?: string; terms?: string } = {
  privacy: undefined,
  terms: undefined,
};
