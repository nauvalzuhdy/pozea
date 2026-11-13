// Cached DeepSeek variations per pose, fetched through the Supabase Edge Function `cue-phrases`.
// The app never holds the DeepSeek key; without the Supabase env vars it simply uses built-in text.

import Storage from 'expo-sqlite/kv-store';

import { CUE_CODES, type CueCode } from '@/features/pose-engine/cues';

import { validatePhrases } from './phrases';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const CACHE_VERSION = 1;
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

interface Cached {
  savedAt: number;
  phrases: Partial<Record<CueCode, string[]>>;
}

const cacheKey = (slug: string) => `cue-phrases:v${CACHE_VERSION}:${slug}`;

function readCache(slug: string): Cached | null {
  try {
    const raw = Storage.getItemSync(cacheKey(slug));
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

/** Cached variations for a pose, possibly empty. Synchronous so the camera can read it at once. */
export function cachedPhrases(slug: string): Partial<Record<CueCode, string[]>> {
  const cached = readCache(slug);
  return cached ? validatePhrases(cached.phrases, CUE_CODES) : {};
}

/**
 * Refreshes the cache for a pose in the background when it is missing or a week old. Sends only
 * the pose slug, its title, and the cue codes; never images. Any failure keeps the old cache.
 */
export async function refreshPhrases(slug: string, title: string): Promise<Partial<Record<CueCode, string[]>> | null> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const cached = readCache(slug);
  if (cached && Date.now() - cached.savedAt < REFRESH_AFTER_MS) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/cue-phrases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ slug, title, codes: CUE_CODES }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { phrases?: unknown };
    const phrases = validatePhrases(body.phrases, CUE_CODES);
    if (Object.keys(phrases).length === 0) return null;
    Storage.setItemSync(cacheKey(slug), JSON.stringify({ savedAt: Date.now(), phrases } satisfies Cached));
    return phrases;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
