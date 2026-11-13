// Supabase Edge Function: friendly Indonesian variations of the camera's instruction cues.
// POST { slug, title, codes } -> { phrases: { CODE: ["...", ...] } }
//
// Only pose slugs, titles and cue codes are sent to DeepSeek, never images. Results are cached per
// pose in public.cue_phrases for a week, and only known poses are accepted, so DeepSeek is called
// at most once per pose per week however many phones ask.
//
// Secrets: `supabase secrets set DEEPSEEK_API_KEY=...` (SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase).

import { createClient } from 'npm:@supabase/supabase-js@2';

const POSES = new Set([
  'peace-sign', 'leaning', 'walking', 'look-back', 'crouch',
  'selfie-smile', 'selfie-peace', 'selfie-chin', 'selfie-tilt', 'selfie-three-quarter', 'selfie-wave',
]);
const CODES = new Set([
  'FULL_BODY', 'STEP_BACK', 'STEP_CLOSER', 'RAISE_LEFT_HAND', 'RAISE_RIGHT_HAND', 'LOWER_LEFT_HAND',
  'LOWER_RIGHT_HAND', 'STRAIGHTEN_ELBOW_LEFT', 'STRAIGHTEN_ELBOW_RIGHT', 'BEND_ELBOW_LEFT',
  'BEND_ELBOW_RIGHT', 'BEND_KNEES', 'STRAIGHTEN_KNEES', 'SMILE', 'CHIN_UP', 'CHIN_DOWN', 'FACE_CAMERA',
  'TURN_LEFT', 'TURN_RIGHT', 'FOLLOW_SILHOUETTE', 'RAISE_HAND', 'LOWER_HAND', 'HAND_CLOSER', 'HAND_WIDER',
  'TILT_HEAD', 'LEVEL_HEAD', 'TURN_HEAD', 'MATCHED',
]);
const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_WORDS = 6;
const MAX_CHARS = 40;
const MAX_VARIANTS = 5;

const MEANINGS: Record<string, string> = {
  FULL_BODY: 'seluruh badan belum masuk kamera',
  STEP_BACK: 'terlalu dekat, perlu mundur',
  STEP_CLOSER: 'terlalu jauh, perlu maju',
  RAISE_LEFT_HAND: 'angkat tangan kiri',
  RAISE_RIGHT_HAND: 'angkat tangan kanan',
  LOWER_LEFT_HAND: 'turunkan tangan kiri sedikit',
  LOWER_RIGHT_HAND: 'turunkan tangan kanan sedikit',
  STRAIGHTEN_ELBOW_LEFT: 'luruskan siku kiri',
  STRAIGHTEN_ELBOW_RIGHT: 'luruskan siku kanan',
  BEND_ELBOW_LEFT: 'tekuk siku kiri',
  BEND_ELBOW_RIGHT: 'tekuk siku kanan',
  BEND_KNEES: 'tekuk lutut',
  STRAIGHTEN_KNEES: 'luruskan kaki',
  SMILE: 'belum senyum',
  CHIN_UP: 'angkat dagu sedikit',
  CHIN_DOWN: 'turunkan dagu sedikit',
  FACE_CAMERA: 'hadap ke kamera',
  TURN_LEFT: 'tengok ke kiri',
  TURN_RIGHT: 'tengok ke kanan',
  FOLLOW_SILHOUETTE: 'samakan posisi badan dengan siluet',
  RAISE_HAND: 'angkat satu tangan',
  LOWER_HAND: 'turunkan tangan sedikit',
  HAND_CLOSER: 'dekatkan tangan ke wajah',
  HAND_WIDER: 'jauhkan tangan dari wajah',
  TILT_HEAD: 'miringkan kepala sedikit',
  LEVEL_HEAD: 'tegakkan kepala',
  TURN_HEAD: 'tengokkan wajah sedikit ke samping',
  MATCHED: 'pose sudah pas, tahan sebentar',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function validate(value: unknown, codes: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (typeof value !== 'object' || value === null) return out;
  for (const code of codes) {
    const list = (value as Record<string, unknown>)[code];
    if (!Array.isArray(list)) continue;
    const valid = list
      .filter((s): s is string => typeof s === 'string' && !/[\r\n<>{}]/.test(s))
      .map((s) => s.trim().replace(/\s+/g, ' '))
      .filter((s) => s.length > 0 && s.length <= MAX_CHARS && s.split(' ').length <= MAX_WORDS)
      .slice(0, MAX_VARIANTS);
    if (valid.length > 0) out[code] = [...new Set(valid)];
  }
  return out;
}

async function generate(title: string, codes: string[]): Promise<Record<string, string[]>> {
  const key = Deno.env.get('DEEPSEEK_API_KEY');
  if (!key) throw new Error('DEEPSEEK_API_KEY is not set');
  const list = codes.map((c) => `- ${c}: ${MEANINGS[c]}`).join('\n');
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: 'deepseek-flash',
      thinking: { type: 'disabled' },
      response_format: { type: 'json_object' },
      max_tokens: 2000,
      messages: [
        {
          role: 'system',
          content:
            'Kamu menulis instruksi singkat untuk aplikasi kamera pose. Bahasa Indonesia santai dan ramah, ' +
            `tiap kalimat paling banyak ${MAX_WORDS} kata, tanpa emoji. Balas hanya JSON, contoh: ` +
            '{"SMILE": ["Senyum dikit ya", "Kasih senyum manis dong"]}',
        },
        {
          role: 'user',
          content: `Pose: ${title}\nBuat 3 sampai ${MAX_VARIANTS} variasi untuk setiap kode berikut:\n${list}`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`DeepSeek ${response.status}`);
  const body = await response.json();
  return validate(JSON.parse(body.choices?.[0]?.message?.content || '{}'), codes);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let input: { slug?: unknown; title?: unknown; codes?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }
  const slug = typeof input.slug === 'string' ? input.slug : '';
  const title = typeof input.title === 'string' ? input.title.slice(0, 40) : '';
  if (!POSES.has(slug) || !title) return json({ error: 'unknown pose' }, 400);
  const codes = Array.isArray(input.codes) ? input.codes.filter((c): c is string => CODES.has(c)) : [];
  if (codes.length === 0) return json({ error: 'no codes' }, 400);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: cached } = await db.from('cue_phrases').select('phrases, updated_at').eq('slug', slug).maybeSingle();
  if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_MS) {
    return json({ phrases: validate(cached.phrases, codes) });
  }

  try {
    const phrases = await generate(title, codes);
    if (Object.keys(phrases).length > 0) {
      await db.from('cue_phrases').upsert({ slug, phrases, updated_at: new Date().toISOString() });
    }
    return json({ phrases });
  } catch (e) {
    console.error(e);
    // The app falls back to its built-in text; an old cache is better than nothing.
    return json({ phrases: cached ? validate(cached.phrases, codes) : {} }, cached ? 200 : 502);
  }
});
