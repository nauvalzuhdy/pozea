// Every image used by onboarding and the paywall, in one place. Files live in assets/onboarding/;
// to swap artwork, replace the file or change the require() path here.

import type { ImageSourcePropType } from 'react-native';

export interface OnboardingImage {
  source: ImageSourcePropType;
  /** Width / height of the file, for layouts that show the whole image. */
  aspectRatio?: number;
}

export const onboardingAssets = {
  welcome: {
    /** Three pose cards, left / centre / right (order follows design/01-get-started.png). */
    cards: [
      { source: require('../../../assets/onboarding/card1_getstarted.jpg') }, // man on a bench
      { source: require('../../../assets/onboarding/card3_getstarted.jpg') }, // woman standing, bag
      { source: require('../../../assets/onboarding/card2_getstarted.jpg') }, // couple sitting
    ] satisfies OnboardingImage[],
  },
  guide: {
    /** Large photo; the glowing outline and frame are part of the image. */
    main: { source: require('../../../assets/onboarding/pose1.jpg') } satisfies OnboardingImage,
    /** Three small examples on the right, top to bottom. */
    thumbs: [
      { source: require('../../../assets/onboarding/pose3.jpg') }, // mirror selfie
      { source: require('../../../assets/onboarding/pose2.jpg') }, // hand in hair, sitting
      { source: require('../../../assets/onboarding/pose4.jpg') }, // hand on hip
    ] satisfies OnboardingImage[],
  },
  paywall: {
    /** Full hero artwork: logo, PRO badge, camera, laurels and headline text are in the image. */
    hero: {
      source: require('../../../assets/onboarding/pricing-image.jpg'),
      aspectRatio: 1536 / 1024,
    } satisfies OnboardingImage,
  },
  /** Small app mark next to "Pozea" in the headers. */
  logo: { source: require('../../../assets/images/icon.png') } satisfies OnboardingImage,
} as const;
