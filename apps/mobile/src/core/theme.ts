// Pozea brand tokens, shared with the landing page (apps/landing/assets/css/style.css).
export const colors = {
  navy: '#0B1530',
  navyLine: '#1E2A52',
  navyBorder: '#2E3B66',
  textOnNavy: '#FFFFFF',
  mutedOnNavy: '#C9D2EA',
  blue: '#2B59FF',
  green: '#19D38A',
  // Pose overlay end points: red while the pose does not match, blue once it does.
  poseMismatch: '#FF4D4D',
  poseMatch: '#2B59FF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { md: 12, pill: 999 } as const;
