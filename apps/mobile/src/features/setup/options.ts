// Choices on the setup screen. Labels are user-facing Indonesian copy.
// The `value` strings are stored in the `poses` table (photo_types, places,
// aspect_ratios in supabase/migrations), so never rename one without a
// migration that rewrites the stored values.

export const photoTypes = [
  { value: 'solo', label: 'Solo' },
  { value: 'couple', label: 'Couple' },
  { value: 'group', label: 'Grup' },
  { value: 'ootd', label: 'OOTD' },
] as const;

export const places = [
  { value: 'cafe', label: 'Kafe' },
  { value: 'beach', label: 'Pantai' },
  { value: 'street', label: 'Jalan' },
  { value: 'indoor', label: 'Dalam ruangan' },
] as const;

export const aspectRatios = [
  { value: '3:4', label: '3:4' },
  { value: '4:5', label: '4:5' },
  { value: '9:16', label: '9:16' },
  { value: '1:1', label: '1:1' },
] as const;

export type PhotoType = (typeof photoTypes)[number]['value'];
export type Place = (typeof places)[number]['value'];
export type AspectRatio = (typeof aspectRatios)[number]['value'];
