import { useState, useEffect } from 'react';

const STRUCTURES = [
  { label: 'Classic Pop', value: 'Verse → Chorus → Verse → Chorus → Bridge → Chorus' },
  { label: 'Folk Ballad', value: 'Verse → Verse → Chorus → Verse → Chorus' },
  { label: 'Modern Pop', value: 'Verse → Pre-Chorus → Chorus → Verse → Pre-Chorus → Chorus → Bridge → Chorus' },
  { label: 'Full Arrangement', value: 'Intro → Verse → Chorus → Verse → Chorus → Bridge → Chorus → Outro' },
  { label: 'Anthem', value: 'Verse → Chorus → Verse → Chorus → Guitar Solo → Bridge → Final Chorus' },
  { label: 'Let It Flow', value: 'unstructured — let it breathe' },
];

const GENRE_CHIPS = [
  'indie folk', 'folk', 'americana', 'country', 'alt-country', 'bluegrass',
  'indie pop', 'dream pop', 'bedroom pop', 'synth pop', 'hyperpop', 'k-pop',
  'alt rock', 'indie rock', 'classic rock', 'punk', 'pop punk', 'post-punk', 'shoegaze', 'grunge', 'emo',
  'metal', 'metalcore',
  'trap', 'drill', 'boom bap', 'lo-fi hip hop', 'phonk', 'conscious hip hop',
  'neo-soul', 'r&b', 'classic soul', 'motown',
  'synthwave', 'vaporwave', 'house', 'deep house', 'techno', 'dubstep', 'drum and bass', 'ambient', 'edm',
  'jazz', 'jazz hop', 'blues', 'funk', 'disco',
  'reggae', 'dancehall', 'afrobeats', 'amapiano', 'reggaeton', 'bossa nova', 'latin pop',
  'gospel',
];

const MOOD_CHIPS = [
  'melancholic', 'defiant', 'dreamy', 'tender', 'anxious', 'hopeful', 'raw', 'longing',
  'swaggering', 'joyful', 'haunting', 'euphoric', 'nostalgic', 'bittersweet', 'angry',
  'vulnerable', 'confident', 'contemplative', 'ecstatic', 'weary', 'playful', 'fierce',
  'lonely', 'romantic', 'rebellious', 'peaceful', 'dark', 'sensual', 'triumphant',
  'regretful', 'mysterious', 'intimate', 'urgent', 'wistful', 'cathartic',
];

const LOADING_PHRASES = [
  'tuning the instrument',
  'finding the first line',
  'humming through the bridge',
  'pressing the master',
];

const PROVIDERS = {
  gemini: {
    id: 'gemini',
    label: 'Google Gemini',
    badge: 'Free tier · no card',
    model: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    keyHint: 'AIzaSy…',
    softDailyLimit: 250,
    softMinuteLimit: 10,
    note: 'Free tier on gemini-2.5-flash. Quotas reset daily. No credit card required.',
    storage: 'lyric-foundry/gemini-key',
  },
  groq: {
    id: 'groq',
    label: 'Groq (Llama)',
    badge: 'Free tier · very fast',
    model: 'llama-3.3-70b-versatile',
    keyUrl: 'https://console.groq.com/keys',
    keyHint: 'gsk_…',
    softDailyLimit: 1000,
    softMinuteLimit: 30,
    note: 'Generous free tier running Llama 3.3 70B. Extremely fast — usually ~1s per song.',
    storage: 'lyric-foundry/groq-key',
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    badge: 'Paid · pay-as-you-go',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-…',
    softDailyLimit: null,
    softMinuteLimit: null,
    note: 'GPT-4o-mini. Pay-as-you-go, roughly $0.001 per song. Needs a funded OpenAI account.',
    storage: 'lyric-foundry/openai-key',
  },
};
const PROVIDER_ORDER = ['gemini', 'groq', 'openai'];
const ACTIVE_PROVIDER_STORAGE = 'lyric-foundry/active-provider';
const USAGE_STORAGE = 'lyric-foundry/usage';

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadUsage() {
  try {
    const raw = localStorage.getItem(USAGE_STORAGE);
    if (!raw) return { date: todayKey(), counts: {} };
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayKey()) return { date: todayKey(), counts: {} };
    return parsed;
  } catch {
    return { date: todayKey(), counts: {} };
  }
}

function saveUsage(usage) {
  try { localStorage.setItem(USAGE_STORAGE, JSON.stringify(usage)); } catch { /* */ }
}

async function callLLM(providerId, apiKey, prompt) {
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error(`Unknown provider: ${providerId}`);

  if (provider.id === 'gemini') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              title: { type: 'STRING' },
              lyrics: { type: 'STRING' },
              stylePrompt: { type: 'STRING' },
            },
            required: ['title', 'lyrics', 'stylePrompt'],
          },
          temperature: 1.0,
          maxOutputTokens: 8192,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return { ok: false, status: response.status, errText };
    }
    const data = await response.json();
    const finishReason = data?.candidates?.[0]?.finishReason;
    const text = (data?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || '').join('').replace(/```json|```/g, '').trim();
    return { ok: true, text, finishReason };
  }

  // OpenAI-compatible (groq, openai)
  const url = provider.id === 'groq'
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: 'system', content: 'You are a skilled lyricist. Respond ONLY with valid JSON matching the schema described by the user. No prose, no markdown fences.' },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 1.0,
      max_tokens: 4096,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    return { ok: false, status: response.status, errText };
  }
  const data = await response.json();
  const finishReason = data?.choices?.[0]?.finish_reason;
  const text = (data?.choices?.[0]?.message?.content || '').replace(/```json|```/g, '').trim();
  return { ok: true, text, finishReason };
}

const CRAFT_RULES = `
CRAFT RULES — these are mandatory, not suggestions:

1. CONCRETE OVER ABSTRACT. Specific sensory images beat emotion-words. Wrong: "I'm broken". Right: "the toothbrush still in the cup beside mine". Every section needs at least one image you could photograph.

2. CLICHÉ BLOCKLIST. None of these appear in any form: "heart on fire", "dance in the rain", "shooting/falling stars" (as romance metaphor), "broken pieces", "fly away", "miles apart", "endless night", "tears in the rain", "wild and free", "love is a battlefield / drug / game", "time stands still", "soul on fire", "walk through fire", "light up the sky", "ride or die", "you complete me", "stronger than you know", "every breath I take". If a line could appear on a generic motivational poster, rewrite it.

3. NARRATIVE ARC. Verse 2 must reveal something Verse 1 didn't — a new detail, a memory, an unreliable-narrator turn, a passage of time. The Bridge must pivot: change perspective, time, addressee, or stakes. The final Chorus should land different than the first because of what came before.

4. HOOK CRAFT. The Chorus is short, rhythmic, and physically repeatable. The opening line of the Chorus should NOT just restate the title. Vary the last line of the Chorus slightly each time it recurs so the return feels earned.

5. SHOW, DON'T TELL. Don't state the dominant emotion explicitly more than once across the whole song. Make the listener feel it through what's happening, not by naming it.

6. RHYME WITH RESTRAINT. Avoid pure AABB unless the genre demands it (folk, country, kids' songs). Favor ABAB, slant rhyme, internal rhyme, or scattered end-rhyme. Reach for fresh pairs — not the moon/June/spoon zone.

7. SINGABILITY. Lines fit a natural breath. Avoid consonant pile-ups ("the strict strength"). Prefer open vowels on syllables that would be held.

8. NO REAL NAMES. No artist names. No real brand names beyond the cultural commons (a Bic lighter, a Honda — fine; trademark drops as flex — not). No titles of existing songs.

9. EARN THE FIRST LINE. The opening line of Verse 1 is the most expensive real estate. It must hook — a question, an image, a small disturbance — not a thesis statement.
`;

const GENRE_PROSODY = {
  'indie folk': 'Balladic 4/4 meter, conversational diction, domestic and natural-world specifics, modest rhyme.',
  'folk': 'Strong narrative throughline, story-song mechanics, AABB or ABAB end-rhyme acceptable, plainspoken language.',
  'americana': 'Storyteller diction, road and home imagery, AABB or ABAB acceptable, plainspoken modesty.',
  'country': 'Concrete nouns (truck, porch, screen door), narrative verses, refrain-driven choruses, AABB acceptable.',
  'alt-country': 'Country specificity with literary lift, slightly heavier diction, narrative verses.',
  'bluegrass': 'Tight rhythmic phrasing, mountain/river imagery, story-song structure, traditional refrains acceptable.',

  'indie pop': 'Conversational specifics, melodic chorus, slight self-aware irony allowed, AABB sparingly.',
  'dream pop': 'Imagistic, slightly dissociative, blurred subjects, softer consonants, repetition as texture.',
  'bedroom pop': 'Conversational and slightly self-aware, domestic close-ups, lo-key irony allowed.',
  'synth pop': 'Hook-first, romantic 80s-inflected imagery, repeatable chorus chants, room for vocoder syllables.',
  'hyperpop': 'Maximalist, chaotic, internet-native diction, double-time chorus, exclamation marks earned.',
  'k-pop': 'Hook-dense structure, English code-switching acceptable, repeatable chants, pre-chorus build is critical.',

  'alt rock': 'Driving 4/4 phrasing, declarative lines, tension between verse intimacy and chorus volume.',
  'indie rock': 'Driving phrasing with literary diction, second-person address common, tension between intimacy and volume.',
  'classic rock': 'Anthemic chorus, declarative verses, room for vocal melisma in the bridge, blues-leaning rhyme.',
  'punk': 'Short declarative lines, anti-authority specifics, no precious metaphors, repeatable shout-along chorus.',
  'pop punk': 'Short declarative lines, suburban specifics, repeatable chant chorus, self-aware confessionalism.',
  'post-punk': 'Detached observational diction, urban imagery, angular phrasing, sparse rhyme.',
  'shoegaze': 'Hushed imagistic lines, blurred subjects, vowel-heavy syllables for sustain, repetition as texture.',
  'grunge': 'Half-mumbled declarations, disillusionment imagery, dynamic verse-to-chorus shift.',
  'emo': 'Intimate confessional verses, dramatic chorus payoff, second-person address, raw specifics.',

  'metal': 'Driving phrasing, mythic or visceral imagery, short percussive chorus lines.',
  'metalcore': 'Tension between melodic clean vocals and screamed lines, big chorus, mythic or visceral imagery.',

  'trap': 'Triplet flows, ad-libs in parentheses ((yeah), (uh), (woo)), contracted diction, percussive consonants, repeating 2-syllable hooks.',
  'drill': 'Triplet flow, double-time bars, urban specifics, ad-lib accents, dark percussive consonants.',
  'boom bap': '90s east-coast cadence, dense internal rhyme, conversational verses, refrain over hook.',
  'lo-fi hip hop': 'Lazy backbeat phrasing, conversational density, half-rapped half-sung delivery, mundane domestic imagery.',
  'phonk': 'Memphis-rooted, atmospheric, repetitive chant phrases, distorted vocal imagery.',
  'conscious hip hop': 'Dense lyricism, multi-syllabic internal rhyme, socially aware specifics, narrative verses.',

  'neo-soul': 'Sensual specificity, syncopation, melisma-friendly open vowels, conversational ad-libs in the bridge.',
  'r&b': 'Sensual specificity, falsetto-friendly open vowels, conversational verses, melisma-friendly phrasing.',
  'rnb': 'Sensual specificity, falsetto-friendly open vowels, conversational verses, melisma-friendly phrasing.',
  'classic soul': 'Falsetto-friendly open vowels, gospel-rooted call-and-response, sensual specificity.',
  'motown': 'Hook-first songwriting, repeatable refrains, romantic narrative arcs, AABB acceptable.',

  'synthwave': 'Neon, highway, midnight, chrome imagery. Longer sustained vowels. Slight detachment in tone.',
  'vaporwave': 'Nostalgic mall-and-screen imagery, slow-mo phrasing, sparse rhyme, slight melancholy.',
  'house': 'Repeatable chant-friendly hooks, percussive syllables, drop-friendly minimal lyrics.',
  'deep house': 'Sensual sparse phrasing, repeatable chant hooks, late-night specifics.',
  'techno': 'Minimal repetitive phrases, percussive syllables, room for instrumental breaks, near-mantra delivery.',
  'dubstep': 'Short pre-drop builds, big chant chorus, percussive consonants, tension and release in line lengths.',
  'drum and bass': 'Half-time chorus vs. double-time verse, club imagery, repeating chant hooks.',
  'ambient': 'Imagistic free verse, minimal end-rhyme, repetition as breath, present-tense observation over narrative.',
  'edm': 'Pre-drop build, chant-friendly chorus, simple repeatable phrases, room for instrumental drops.',
  'dance': 'Compressed lines, percussive syllables, drop-friendly chant phrases, repetition is a feature.',
  'electronic': 'Short imagistic lines, room for instrumental breaks, repetition allowed.',

  'jazz': 'Sophisticated diction, internal rhyme, longer lines that swing, room for scat-friendly vowels.',
  'jazz hop': 'Smooth conversational delivery, internal rhyme, jazz-inflected diction, mellow.',
  'blues': '12-bar repetition structure (AAB), call-and-response, plainspoken hardship imagery.',
  'funk': 'Syncopated phrasing, percussive consonants, exclamatory shouts, repeating refrains.',
  'disco': 'Repeatable hook chorus, dance-floor imagery, AABB acceptable, exuberance.',

  'reggae': 'Off-beat phrasing, communal pronouns, social commentary or romantic specificity, call-and-response.',
  'dancehall': 'Patois-inflected if appropriate to writer, chant hooks, percussive consonants.',
  'afrobeats': 'Repeatable melodic refrains, pidgin-English-friendly, percussive vocal delivery, communal energy.',
  'amapiano': 'Sparse repetitive vocal phrases, log-drum rhythmic feel, conversational specifics.',
  'reggaeton': 'Dembow-friendly cadence, repeatable hook lines, percussive consonants, urban specificity.',
  'bossa nova': 'Soft syncopation, sensual conversational diction, romantic specifics, longer vowel sounds.',
  'latin pop': 'Big hooks, romantic narrative, repeatable chorus, bilingual code-switching acceptable.',

  'gospel': 'Communal pronouns (we, our), call-and-response chorus, witness-and-testimony structure, build to release.',
};

function genreNote(genres) {
  if (!genres || genres.length === 0) return '';
  const found = [];
  for (const g of genres) {
    const key = String(g).trim().toLowerCase();
    if (!key) continue;
    let entry = GENRE_PROSODY[key];
    if (!entry) {
      for (const [k, v] of Object.entries(GENRE_PROSODY)) {
        if (key.includes(k) || k.includes(key)) { entry = v; break; }
      }
    }
    if (entry) found.push(`- ${g}: ${entry}`);
  }
  if (found.length === 0) return '';
  return `\nGENRE PROSODY GUIDANCE${genres.length > 1 ? ' (blend these idioms — the song should feel like an honest fusion, not a sampler)' : ''}:\n${found.join('\n')}`;
}

function formatStructureField(structures) {
  if (!structures || structures.length === 0) return 'no fixed structure — choose what serves the subject';
  if (structures.length === 1) return structures[0];
  return `Consider blending these structural ideas — pick one as the spine and let the others inform the verses or bridge:\n${structures.map((s, i) => `  ${i + 1}. ${s}`).join('\n')}`;
}

function buildPrompt({ theme, genres, moods, structures, notes, styleSetsTone }) {
  const toneMode = styleSetsTone
    ? `STYLE-DICTATES-TONE MODE IS ON.
The selected genres and moods do NOT just sit under the song — they actively shape vocabulary, rhythm, imagery density, rhyme scheme, line length, and even what the song is allowed to talk about. A trap song about heartbreak and a country song about heartbreak should read like different languages. Match the lexicon to the genre's actual culture. When multiple genres are selected, fuse them honestly — pick the dominant cadence and let the others colour the diction.`
    : `Tone mode: literary. The selected genres and moods inform the song but the lyrics keep their own restrained literary tone — fewer genre tics, more universal imagery.`;

  const genreField = (genres && genres.length > 0) ? genres.join(', ') : 'choose what fits the subject';
  const moodField = (moods && moods.length > 0) ? moods.join(', ') : 'fitting to the subject';

  return `You are a skilled lyricist writing for Suno AI. You write lyrics that sound like a real human songwriter wrote them, not lyrics that sound like an AI hit a "generate" button.

${CRAFT_RULES}

${toneMode}
${genreNote(genres)}

SONG BRIEF
Subject: ${theme}
Genre(s): ${genreField}
Mood(s): ${moodField}
Structure: ${formatStructureField(structures)}
Additional direction from the writer: ${notes || 'none'}

OUTPUT FORMAT — respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "title": "evocative song title (avoid 'the', avoid generic single-word titles)",
  "lyrics": "full lyrics with Suno section tags",
  "stylePrompt": "comma-separated style descriptors under 200 chars"
}

LYRICS FORMATTING RULES
- Use Suno section tags in square brackets, each on its own line: [Intro], [Verse 1], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro], [Instrumental], [Guitar Solo], etc.
- Blank line between sections
- Number the verses ([Verse 1], [Verse 2]) when there's more than one
- 250-380 words of actual lyric content (excluding tags)
- The final chorus may have a small extension or tag line to signal the ending

STYLE PROMPT RULES
- Under 200 characters, comma-separated descriptors for Suno's "Style of Music" field
- Include: genre, vocal style (gender / age if relevant), key instruments, production texture, tempo feel
- Example shape: "indie folk, melancholic female vocals, fingerpicked acoustic guitar, intimate, lo-fi production, 80bpm"
- No artist names. No song titles.

Before you write: imagine a real person needs to sing this song into a microphone tomorrow. Then write.`;
}

function Equaliser({ active }) {
  const bars = [0.5, 0.8, 0.3, 0.95, 0.6, 0.4, 0.75, 0.55, 0.85, 0.3, 0.7, 0.5];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '24px' }}>
      {bars.map((h, i) => (
        <div
          key={i}
          style={{
            width: '3px',
            background: 'var(--orange)',
            height: `${h * 100}%`,
            borderRadius: '1px',
            animation: active ? `eq-pulse ${0.7 + (i % 4) * 0.18}s ease-in-out ${i * 0.05}s infinite alternate` : 'none',
            opacity: active ? 1 : 0.35,
            transition: 'opacity 0.4s ease',
          }}
        />
      ))}
    </div>
  );
}

export default function SunoLyricsCreator() {
  const [theme, setTheme] = useState('');
  const [genres, setGenres] = useState([]);
  const [customGenres, setCustomGenres] = useState('');
  const [moods, setMoods] = useState([]);
  const [customMoods, setCustomMoods] = useState('');
  const [structures, setStructures] = useState([STRUCTURES[0].value]);
  const [customStructure, setCustomStructure] = useState('');
  const [notes, setNotes] = useState('');
  const [styleSetsTone, setStyleSetsTone] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingPhrase, setLoadingPhrase] = useState(LOADING_PHRASES[0]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copiedLyrics, setCopiedLyrics] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState(false);

  const [provider, setProvider] = useState('gemini');
  const [keys, setKeys] = useState({});
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyPanel, setShowKeyPanel] = useState(false);
  const [showWhyBetter, setShowWhyBetter] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [usage, setUsage] = useState({ date: todayKey(), counts: {} });
  const [rateLimitedProvider, setRateLimitedProvider] = useState(null);

  useEffect(() => {
    try {
      const loadedKeys = {};
      for (const id of PROVIDER_ORDER) {
        loadedKeys[id] = localStorage.getItem(PROVIDERS[id].storage) || '';
      }
      setKeys(loadedKeys);
      const savedProvider = localStorage.getItem(ACTIVE_PROVIDER_STORAGE);
      const initialProvider = PROVIDERS[savedProvider] ? savedProvider : 'gemini';
      setProvider(initialProvider);
      setKeyDraft(loadedKeys[initialProvider] || '');
      const anyKey = Object.values(loadedKeys).some(Boolean);
      if (!anyKey) setShowKeyPanel(true);
      setUsage(loadUsage());
    } catch {
      // localStorage may be unavailable
    }
  }, []);

  useEffect(() => {
    setKeyDraft(keys[provider] || '');
    try { localStorage.setItem(ACTIVE_PROVIDER_STORAGE, provider); } catch { /* */ }
  }, [provider, keys]);

  const activeProvider = PROVIDERS[provider];
  const activeKey = keys[provider] || '';
  const todayCount = usage.counts[provider] || 0;
  const isAtSoftLimit = activeProvider.softDailyLimit != null && todayCount >= activeProvider.softDailyLimit;

  useEffect(() => {
    if (!loading) return;
    let i = 0;
    const interval = setInterval(() => {
      i = (i + 1) % LOADING_PHRASES.length;
      setLoadingPhrase(LOADING_PHRASES[i]);
    }, 1400);
    return () => clearInterval(interval);
  }, [loading]);

  const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const toggleIn = (list, value) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  const addRandomUnused = (list, pool) => {
    const remaining = pool.filter((p) => !list.includes(p));
    if (remaining.length === 0) return list;
    return [...list, pickRandom(remaining)];
  };
  const splitCustom = (text) =>
    text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  const mergedUnique = (chips, customText) => {
    const customList = splitCustom(customText);
    const seen = new Set();
    const out = [];
    for (const v of [...chips, ...customList]) {
      const k = v.toLowerCase();
      if (!seen.has(k)) {
        seen.add(k);
        out.push(v);
      }
    }
    return out;
  };

  const saveKey = () => {
    const trimmed = keyDraft.trim();
    try {
      if (trimmed) localStorage.setItem(activeProvider.storage, trimmed);
      else localStorage.removeItem(activeProvider.storage);
    } catch {
      // ignore
    }
    setKeys((prev) => ({ ...prev, [provider]: trimmed }));
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1800);
    if (trimmed) setShowKeyPanel(false);
  };

  const clearKey = () => {
    setKeyDraft('');
    setKeys((prev) => ({ ...prev, [provider]: '' }));
    try { localStorage.removeItem(activeProvider.storage); } catch { /* */ }
  };

  const bumpUsage = () => {
    setUsage((prev) => {
      const fresh = prev.date === todayKey() ? prev : { date: todayKey(), counts: {} };
      const next = {
        date: fresh.date,
        counts: { ...fresh.counts, [provider]: (fresh.counts[provider] || 0) + 1 },
      };
      saveUsage(next);
      return next;
    });
  };

  const generate = async () => {
    if (!activeKey) {
      setError(`Add your ${activeProvider.label} API key first — click the key pill in the top right.`);
      setShowKeyPanel(true);
      return;
    }
    if (!theme.trim()) {
      setError("Give it a subject first — what's the song about?");
      return;
    }
    setError('');
    setRateLimitedProvider(null);
    setLoading(true);
    setResult(null);

    try {
      const allGenres = mergedUnique(genres, customGenres);
      const allMoods = mergedUnique(moods, customMoods);
      const allStructures = customStructure.trim()
        ? [...structures, customStructure.trim()]
        : structures;
      const prompt = buildPrompt({
        theme,
        genres: allGenres,
        moods: allMoods,
        structures: allStructures,
        notes,
        styleSetsTone,
      });

      const result = await callLLM(provider, activeKey, prompt);

      if (!result.ok) {
        if (result.status === 401 || (result.status === 400 && /api[_ ]?key/i.test(result.errText || ''))) {
          throw new Error(`That ${activeProvider.label} key was rejected. Check it at ${activeProvider.keyUrl}.`);
        }
        if (result.status === 429) {
          setRateLimitedProvider(provider);
          throw new Error(`You've hit ${activeProvider.label}'s rate limit. ${activeProvider.softDailyLimit ? `Free tier resets daily (~${activeProvider.softDailyLimit} req/day).` : 'Wait a moment and try again.'} You can also switch to another provider in the key panel.`);
        }
        if (result.status === 402 || /insufficient|billing/i.test(result.errText || '')) {
          throw new Error(`${activeProvider.label} reports your account is out of credit / billing isn't set up. Add credit or switch provider.`);
        }
        throw new Error(`${activeProvider.label} returned ${result.status}. ${result.errText ? '' : 'Try again.'}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(result.text);
      } catch (parseErr) {
        if (result.finishReason === 'MAX_TOKENS' || result.finishReason === 'length') {
          throw new Error('The song got cut off mid-line. Try a shorter structure or simpler direction notes.');
        }
        if (result.finishReason === 'SAFETY' || result.finishReason === 'content_filter') {
          throw new Error(`${activeProvider.label} blocked the response on safety grounds. Try rephrasing the subject.`);
        }
        console.error('JSON parse failed. Raw text:', result.text);
        throw new Error('The model returned malformed JSON. Try generating again.');
      }
      setResult(parsed);
      bumpUsage();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Hit a snag. Try generating again.');
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text, which) => {
    navigator.clipboard.writeText(text);
    if (which === 'lyrics') {
      setCopiedLyrics(true);
      setTimeout(() => setCopiedLyrics(false), 1800);
    } else {
      setCopiedStyle(true);
      setTimeout(() => setCopiedStyle(false), 1800);
    }
  };

  const reset = () => {
    setResult(null);
    setError('');
  };

  const renderLyrics = (lyrics) => {
    if (!lyrics) return null;
    return lyrics.split('\n').map((line, i) => {
      const trimmed = line.trim();
      const isTag = /^\[.+\]$/.test(trimmed);
      if (isTag) {
        return (
          <div key={i} style={{
            marginTop: i === 0 ? 0 : '1.5rem',
            marginBottom: '0.65rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.7rem',
          }}>
            <span style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.7rem',
              letterSpacing: '0.18em',
              fontWeight: 600,
              textTransform: 'uppercase',
              color: 'var(--cream)',
              background: 'var(--orange)',
              padding: '0.3rem 0.75rem',
              borderRadius: '999px',
              display: 'inline-block',
            }}>
              {trimmed.replace(/[\[\]]/g, '')}
            </span>
            <span style={{ flex: 1, height: '1px', background: 'var(--dark)', opacity: 0.1 }} />
          </div>
        );
      }
      if (trimmed === '') return <div key={i} style={{ height: '0.4rem' }} />;
      return (
        <div key={i} style={{
          fontFamily: "'Lora', Georgia, serif",
          fontSize: '1.12rem',
          lineHeight: 1.6,
          color: 'var(--dark)',
          letterSpacing: '-0.005em',
        }}>
          {line}
        </div>
      );
    });
  };

  const keyPreview = activeKey ? `${activeKey.slice(0, 6)}…${activeKey.slice(-4)}` : 'not set';
  const providersWithKeys = PROVIDER_ORDER.filter((id) => keys[id]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,600&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&display=swap');

        :root {
          --dark: #141413;
          --cream: #faf9f5;
          --cream-deep: #f3f1e8;
          --mid: #b0aea5;
          --light-gray: #e8e6dc;
          --orange: #d97757;
          --orange-soft: #e89478;
          --orange-deep: #b85e42;
          --blue: #6a9bcc;
          --green: #788c5d;
        }

        * { box-sizing: border-box; }

        .slc-root {
          font-family: 'Lora', Georgia, serif;
          color: var(--dark);
          background: var(--cream);
          min-height: 100vh;
          position: relative;
          overflow-x: hidden;
        }
        .slc-root::before {
          content: ''; position: absolute; top: -200px; right: -200px;
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(217, 119, 87, 0.18) 0%, rgba(217, 119, 87, 0) 65%);
          pointer-events: none; z-index: 0;
        }
        .slc-root::after {
          content: ''; position: absolute; top: 600px; left: -300px;
          width: 800px; height: 800px;
          background: radial-gradient(circle, rgba(106, 155, 204, 0.1) 0%, rgba(106, 155, 204, 0) 60%);
          pointer-events: none; z-index: 0;
        }
        .slc-content {
          position: relative; z-index: 2;
          max-width: 920px; margin: 0 auto;
          padding: 2rem 1.5rem 5rem;
        }

        h1, h2, h3, h4 {
          font-family: 'Poppins', sans-serif;
          font-weight: 700; letter-spacing: -0.025em; margin: 0;
        }

        .header-bar {
          display: flex; justify-content: space-between; align-items: center;
          padding-bottom: 1.5rem; margin-bottom: 2rem;
          border-bottom: 1px solid var(--light-gray);
          gap: 1rem; flex-wrap: wrap;
        }
        .wordmark {
          display: flex; align-items: center; gap: 0.6rem;
          font-family: 'Poppins', sans-serif; font-weight: 700;
          font-size: 0.95rem; letter-spacing: -0.01em; color: var(--dark);
        }
        .logo-mark {
          width: 28px; height: 28px; border-radius: 50%;
          background: var(--orange); position: relative; flex-shrink: 0;
        }
        .logo-mark::after {
          content: ''; position: absolute; top: 50%; left: 50%;
          width: 10px; height: 10px; background: var(--cream);
          border-radius: 50%; transform: translate(-50%, -50%);
        }
        .header-meta {
          font-family: 'Poppins', sans-serif; font-size: 0.75rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--mid); font-weight: 500;
        }
        .header-right { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }

        .key-pill {
          font-family: 'Poppins', sans-serif; font-size: 0.72rem;
          letter-spacing: 0.08em; text-transform: uppercase;
          font-weight: 600; padding: 0.45rem 0.85rem;
          border-radius: 999px; cursor: pointer;
          border: 1.5px solid var(--light-gray);
          background: var(--cream); color: var(--dark);
          display: inline-flex; align-items: center; gap: 0.45rem;
          transition: all 0.2s ease;
        }
        .key-pill:hover { border-color: var(--dark); }
        .key-pill.ok { border-color: var(--green); color: var(--green); }
        .key-pill.missing { border-color: var(--orange); color: var(--orange-deep); background: rgba(217, 119, 87, 0.08); }
        .key-pill .pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--mid);
        }
        .key-pill.ok .pill-dot { background: var(--green); }
        .key-pill.missing .pill-dot { background: var(--orange); }

        .key-panel {
          background: var(--cream-deep);
          border: 1.5px solid var(--light-gray);
          border-radius: 18px; padding: 1.4rem 1.5rem;
          margin-bottom: 2.5rem;
          display: flex; flex-direction: column; gap: 0.9rem;
        }
        .key-panel.warn {
          border-color: var(--orange);
          background: rgba(217, 119, 87, 0.06);
        }
        .key-panel h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1rem; font-weight: 600;
          color: var(--dark); margin: 0;
        }
        .key-panel p {
          font-family: 'Lora', Georgia, serif;
          font-size: 0.95rem; color: var(--dark);
          opacity: 0.75; margin: 0; line-height: 1.55;
        }
        .key-panel a {
          color: var(--orange); font-weight: 600;
          text-decoration: underline; text-underline-offset: 2px;
        }
        .key-row {
          display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;
        }
        .key-input {
          font-family: 'Poppins', sans-serif;
          font-size: 0.92rem;
          background: var(--cream);
          border: 1.5px solid var(--light-gray);
          border-radius: 10px;
          color: var(--dark);
          padding: 0.7rem 0.9rem;
          outline: none; flex: 1; min-width: 260px;
          letter-spacing: 0.02em;
        }
        .key-input:focus { border-color: var(--orange); }
        .key-meta-row {
          font-family: 'Poppins', sans-serif; font-size: 0.72rem;
          color: var(--mid); letter-spacing: 0.05em;
          display: flex; gap: 0.8rem; flex-wrap: wrap;
        }
        .key-meta-row span.saved { color: var(--green); font-weight: 600; }

        .key-warn {
          margin-top: 0.6rem;
          padding: 1.1rem 1.2rem 0.95rem;
          background: rgba(217, 119, 87, 0.07);
          border: 1px solid rgba(217, 119, 87, 0.35);
          border-left: 3px solid var(--orange);
          border-radius: 12px;
        }
        .key-warn-head {
          font-family: 'Poppins', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--orange-deep);
          letter-spacing: 0.02em;
          display: flex;
          align-items: center;
          gap: 0.55rem;
          margin-bottom: 0.7rem;
        }
        .warn-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: var(--orange);
          color: var(--cream);
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 0.85rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .key-warn ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .key-warn li {
          font-family: 'Lora', Georgia, serif;
          font-size: 0.92rem;
          line-height: 1.55;
          color: var(--dark);
          padding-left: 1.2rem;
          position: relative;
        }
        .key-warn li::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0.65em;
          width: 6px;
          height: 2px;
          background: var(--orange);
        }
        .key-warn li strong {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
        }
        .key-warn code {
          font-family: 'Poppins', sans-serif;
          font-size: 0.85rem;
          background: var(--cream-deep);
          padding: 0.05rem 0.35rem;
          border-radius: 4px;
        }
        .key-warn a {
          color: var(--orange-deep);
          font-weight: 600;
        }
        .key-warn-foot {
          margin: 0.9rem 0 0 !important;
          font-family: 'Lora', Georgia, serif;
          font-size: 0.82rem !important;
          font-style: italic;
          color: var(--mid) !important;
          opacity: 1 !important;
          line-height: 1.55;
        }

        .provider-tabs {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.55rem;
          margin: 0.2rem 0 0.4rem;
        }
        .provider-tab {
          font-family: 'Poppins', sans-serif;
          background: var(--cream);
          border: 1.5px solid var(--light-gray);
          border-radius: 12px;
          padding: 0.7rem 0.9rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s ease;
          display: flex; flex-direction: column; gap: 0.18rem;
          position: relative;
          color: var(--dark);
        }
        .provider-tab:hover { border-color: var(--dark); }
        .provider-tab.active {
          background: var(--dark); color: var(--cream); border-color: var(--dark);
        }
        .provider-tab-name {
          font-size: 0.92rem; font-weight: 600;
        }
        .provider-tab-badge {
          font-size: 0.66rem; letter-spacing: 0.08em;
          text-transform: uppercase; font-weight: 500;
          opacity: 0.65;
        }
        .provider-tab.active .provider-tab-badge { color: var(--orange-soft); opacity: 1; }
        .provider-tab-check {
          position: absolute; top: 0.5rem; right: 0.65rem;
          color: var(--green); font-weight: 700; font-size: 0.85rem;
        }
        .provider-tab.active .provider-tab-check { color: var(--orange-soft); }

        .usage-block {
          margin-top: 0.6rem;
          padding: 1rem 1.1rem;
          background: var(--cream);
          border: 1px solid var(--light-gray);
          border-radius: 12px;
        }
        .usage-head {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-bottom: 0.7rem; flex-wrap: wrap; gap: 0.4rem;
        }
        .usage-title {
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          font-weight: 600;
          color: var(--dark);
        }
        .usage-disclaimer {
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 0.78rem;
          color: var(--mid);
        }
        .usage-rows { display: flex; flex-direction: column; gap: 0.7rem; }
        .usage-row.limited {
          padding: 0.4rem 0.6rem;
          background: rgba(217, 119, 87, 0.07);
          border-radius: 8px;
          margin: -0.2rem -0.3rem;
        }
        .usage-row-head {
          display: flex; justify-content: space-between; align-items: baseline;
          margin-bottom: 0.3rem; gap: 0.6rem; flex-wrap: wrap;
        }
        .usage-name {
          font-family: 'Poppins', sans-serif;
          font-size: 0.88rem;
          font-weight: 600; color: var(--dark);
        }
        .usage-count {
          font-family: 'Poppins', sans-serif;
          font-size: 0.76rem;
          color: var(--mid);
        }
        .usage-bar {
          width: 100%; height: 6px;
          background: var(--light-gray);
          border-radius: 999px; overflow: hidden;
        }
        .usage-bar-fill {
          height: 100%;
          background: var(--green);
          border-radius: 999px;
          transition: width 0.3s ease;
        }
        .usage-bar-fill.warn { background: var(--orange); }
        .usage-bar-fill.full { background: var(--orange-deep); }
        .usage-limit-msg {
          margin-top: 0.4rem;
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 0.82rem;
          color: var(--orange-deep);
        }

        .rate-limit-banner {
          margin-top: 1.2rem;
          padding: 1rem 1.2rem;
          background: rgba(217, 119, 87, 0.12);
          border: 1.5px solid var(--orange);
          border-radius: 14px;
        }
        .rate-limit-head {
          font-family: 'Poppins', sans-serif;
          font-size: 0.88rem;
          font-weight: 700;
          color: var(--orange-deep);
          margin-bottom: 0.3rem;
        }
        .rate-limit-body {
          font-family: 'Lora', Georgia, serif;
          font-size: 0.95rem;
          color: var(--dark);
          line-height: 1.55;
        }
        .rate-limit-switch {
          font-family: 'Poppins', sans-serif;
          font-size: 0.85rem;
          font-weight: 600;
          background: var(--cream);
          color: var(--dark);
          border: 1.5px solid var(--dark);
          border-radius: 999px;
          padding: 0.2rem 0.7rem;
          cursor: pointer;
          margin: 0 0.1rem;
        }
        .rate-limit-switch:hover { background: var(--dark); color: var(--cream); }

        .hero { margin-bottom: 2.4rem; position: relative; }
        .hero-eyebrow {
          font-family: 'Poppins', sans-serif; font-size: 0.78rem;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--orange); font-weight: 600;
          margin-bottom: 1.2rem;
          display: flex; align-items: center; gap: 0.7rem;
        }
        .hero-eyebrow::before {
          content: ''; width: 28px; height: 1.5px; background: var(--orange);
        }
        .hero-title {
          font-size: clamp(2.6rem, 7vw, 5rem);
          line-height: 0.98; margin-bottom: 1.4rem;
          color: var(--dark); font-weight: 700;
        }
        .hero-title em {
          font-style: italic; font-weight: 600;
          color: var(--orange);
          font-family: 'Lora', Georgia, serif;
          letter-spacing: -0.02em;
        }
        .hero-sub {
          font-family: 'Lora', Georgia, serif;
          font-size: 1.2rem; line-height: 1.55;
          color: var(--dark); opacity: 0.7;
          max-width: 580px; margin-bottom: 1.4rem;
        }

        .why-button {
          font-family: 'Poppins', sans-serif;
          font-size: 0.78rem; letter-spacing: 0.04em;
          font-weight: 600;
          background: transparent;
          border: 1.5px solid var(--dark);
          color: var(--dark);
          padding: 0.55rem 1rem; border-radius: 999px;
          cursor: pointer;
          display: inline-flex; align-items: center; gap: 0.45rem;
          transition: all 0.2s ease;
        }
        .why-button:hover { background: var(--dark); color: var(--cream); }
        .why-button.open { background: var(--dark); color: var(--cream); }
        .why-arrow { transition: transform 0.3s ease; display: inline-block; }
        .why-button.open .why-arrow { transform: rotate(90deg); }

        .why-panel {
          margin-top: 1.2rem; margin-bottom: 1.5rem;
          background: var(--dark); color: var(--cream);
          border-radius: 20px; padding: 1.8rem 1.8rem 1.6rem;
          position: relative; overflow: hidden;
          animation: fade-in 0.4s ease-out both;
        }
        .why-panel::before {
          content: ''; position: absolute; top: -40%; right: -10%;
          width: 320px; height: 320px;
          background: radial-gradient(circle, rgba(217, 119, 87, 0.3) 0%, transparent 60%);
          pointer-events: none;
        }
        .why-panel-header {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--orange-soft);
          font-weight: 600; margin-bottom: 0.4rem;
          position: relative; z-index: 2;
        }
        .why-panel h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1.5rem; font-weight: 700;
          color: var(--cream); margin-bottom: 1.2rem;
          position: relative; z-index: 2;
        }
        .why-panel ul {
          list-style: none; margin: 0; padding: 0;
          position: relative; z-index: 2;
          display: flex; flex-direction: column; gap: 0.85rem;
        }
        .why-panel li {
          font-family: 'Lora', Georgia, serif;
          font-size: 1rem; line-height: 1.55;
          color: var(--cream); opacity: 0.92;
          padding-left: 1.5rem; position: relative;
        }
        .why-panel li::before {
          content: ''; position: absolute;
          left: 0; top: 0.65em;
          width: 8px; height: 2px;
          background: var(--orange);
        }
        .why-panel li strong {
          font-family: 'Poppins', sans-serif;
          font-weight: 700; color: var(--orange-soft);
        }

        .step-num {
          font-family: 'Poppins', sans-serif; font-weight: 600;
          font-size: 0.72rem; letter-spacing: 0.15em;
          color: var(--orange); text-transform: uppercase;
        }
        .step-title {
          font-family: 'Poppins', sans-serif; font-weight: 600;
          font-size: 1.05rem; color: var(--dark);
          letter-spacing: -0.01em; margin-top: 0.2rem;
        }
        .step-hint {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          font-size: 0.9rem; color: var(--mid);
        }
        .step-header {
          display: flex; justify-content: space-between;
          align-items: flex-end; margin-bottom: 1rem; gap: 1rem;
        }
        section.step { margin-bottom: 2.4rem; }

        .field-input {
          font-family: 'Lora', Georgia, serif; font-size: 1.15rem;
          background: transparent; border: none;
          border-bottom: 1.5px solid var(--dark);
          color: var(--dark); padding: 0.5rem 0;
          width: 100%; outline: none; transition: border-color 0.25s;
        }
        .field-input:focus { border-bottom-color: var(--orange); }
        .field-input::placeholder { color: var(--mid); font-style: italic; }

        .field-textarea {
          font-family: 'Lora', Georgia, serif; font-size: 1.08rem;
          background: var(--cream);
          border: 1.5px solid var(--light-gray);
          border-radius: 14px; color: var(--dark);
          padding: 0.95rem 1.1rem; width: 100%;
          outline: none; resize: vertical;
          line-height: 1.55; transition: all 0.25s;
        }
        .field-textarea:focus {
          border-color: var(--orange);
          background: #fffdf7;
          box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.08);
        }
        .field-textarea::placeholder { color: var(--mid); font-style: italic; }

        .surprise-btn {
          font-family: 'Poppins', sans-serif; font-size: 0.72rem;
          letter-spacing: 0.12em; text-transform: uppercase;
          background: transparent; border: none; color: var(--orange);
          cursor: pointer; font-weight: 600;
          padding: 0.3rem 0.6rem; border-radius: 999px;
          transition: background 0.2s;
        }
        .surprise-btn:hover { background: rgba(217, 119, 87, 0.1); }

        .step-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
        .surprise-btn.clear-btn { color: var(--mid); }
        .surprise-btn.clear-btn:hover { background: var(--light-gray); color: var(--dark); }

        .multi-hint {
          margin-left: 0.55rem;
          font-family: 'Poppins', sans-serif;
          font-size: 0.6rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--mid);
          font-weight: 500;
          padding: 0.18rem 0.5rem;
          background: var(--cream-deep);
          border-radius: 999px;
          vertical-align: middle;
        }
        .selection-summary {
          margin-top: 0.9rem;
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
          font-size: 0.9rem;
          color: var(--mid);
        }
        .selection-summary strong {
          font-family: 'Poppins', sans-serif;
          font-style: normal;
          color: var(--orange);
          font-weight: 600;
        }

        .custom-input-wrap {
          margin-top: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .custom-input-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.7rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--mid);
          font-weight: 600;
        }
        .field-input.custom-input {
          font-size: 1rem;
          border-bottom-style: dashed;
          border-bottom-color: var(--mid);
        }
        .field-input.custom-input:focus { border-bottom-color: var(--orange); border-bottom-style: solid; }

        .chips { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1rem; }
        .chip {
          font-family: 'Poppins', sans-serif; font-size: 0.82rem;
          font-weight: 500; padding: 0.45rem 0.95rem;
          border: 1.5px solid var(--light-gray);
          background: var(--cream); color: var(--dark);
          cursor: pointer; border-radius: 999px;
          transition: all 0.2s ease;
        }
        .chip:hover { border-color: var(--dark); transform: translateY(-1px); }
        .chip.active {
          background: var(--dark); color: var(--cream);
          border-color: var(--dark);
        }

        .structure-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
          gap: 0.6rem;
        }
        .structure-card {
          font-family: 'Lora', Georgia, serif;
          padding: 0.85rem 1rem;
          border: 1.5px solid var(--light-gray);
          background: var(--cream); border-radius: 14px;
          cursor: pointer; text-align: left;
          transition: all 0.2s ease;
          display: flex; flex-direction: column; gap: 0.3rem;
          color: var(--dark);
        }
        .structure-card:hover { border-color: var(--dark); transform: translateY(-1px); }
        .structure-card.active {
          background: var(--dark); color: var(--cream);
          border-color: var(--dark);
        }
        .structure-card .s-label {
          font-family: 'Poppins', sans-serif; font-size: 0.7rem;
          letter-spacing: 0.14em; text-transform: uppercase;
          font-weight: 600; color: var(--orange);
        }
        .structure-card.active .s-label { color: var(--orange-soft); }
        .structure-card .s-value { font-size: 0.92rem; line-height: 1.35; }

        .tone-toggle-row {
          margin-top: 1.4rem;
          display: flex; align-items: center; gap: 0.9rem;
          padding: 0.9rem 1.1rem;
          background: var(--cream-deep);
          border: 1.5px solid var(--light-gray);
          border-radius: 14px;
          flex-wrap: wrap;
        }
        .tone-toggle-row.on { border-color: var(--orange); }

        .toggle-switch {
          --w: 44px; --h: 24px;
          width: var(--w); height: var(--h);
          border-radius: var(--h); border: none; cursor: pointer;
          background: var(--mid); position: relative; padding: 0;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .toggle-switch.on { background: var(--orange); }
        .toggle-switch::after {
          content: ''; position: absolute;
          top: 3px; left: 3px;
          width: calc(var(--h) - 6px); height: calc(var(--h) - 6px);
          border-radius: 50%; background: var(--cream);
          transition: transform 0.2s ease;
        }
        .toggle-switch.on::after {
          transform: translateX(calc(var(--w) - var(--h)));
        }

        .toggle-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.92rem; font-weight: 600;
          color: var(--dark); letter-spacing: -0.005em;
        }
        .toggle-sub {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          font-size: 0.85rem; color: var(--mid);
          flex-basis: 100%;
        }

        .generate-block {
          margin-top: 2.5rem; padding: 2rem;
          background: var(--dark); border-radius: 20px;
          color: var(--cream);
          display: flex; align-items: center; justify-content: space-between;
          gap: 1.5rem; flex-wrap: wrap;
          position: relative; overflow: hidden;
        }
        .generate-block::before {
          content: ''; position: absolute;
          top: -50%; right: -10%;
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(217, 119, 87, 0.35) 0%, transparent 60%);
          pointer-events: none;
        }
        .generate-block-text { position: relative; z-index: 2; flex: 1; min-width: 200px; }
        .generate-block-text h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 1.6rem; font-weight: 700;
          margin-bottom: 0.3rem; color: var(--cream);
        }
        .generate-block-text p {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          color: var(--mid); font-size: 0.98rem; margin: 0;
        }

        .btn-primary {
          font-family: 'Poppins', sans-serif;
          font-weight: 600; font-size: 1.02rem;
          background: var(--orange); color: var(--cream);
          border: none; padding: 1rem 1.7rem;
          cursor: pointer; letter-spacing: -0.005em;
          transition: all 0.2s ease; border-radius: 999px;
          display: inline-flex; align-items: center; gap: 0.6rem;
          position: relative; z-index: 2;
          box-shadow: 0 4px 20px rgba(217, 119, 87, 0.35);
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--orange-soft); transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(217, 119, 87, 0.5);
        }
        .btn-primary:disabled { opacity: 0.7; cursor: wait; }
        .btn-primary svg { transition: transform 0.2s ease; }
        .btn-primary:hover:not(:disabled) svg { transform: translateX(3px); }

        .btn-ghost {
          font-family: 'Poppins', sans-serif;
          font-size: 0.85rem; font-weight: 500;
          background: var(--cream); color: var(--dark);
          border: 1.5px solid var(--light-gray);
          padding: 0.6rem 1.1rem;
          cursor: pointer; border-radius: 999px;
          transition: all 0.2s ease;
          display: inline-flex; align-items: center; gap: 0.4rem;
        }
        .btn-ghost:hover { border-color: var(--dark); background: var(--cream-deep); }
        .btn-ghost.copied {
          background: var(--green); border-color: var(--green); color: var(--cream);
        }
        .btn-ghost.danger {
          color: var(--orange-deep);
        }
        .btn-ghost.danger:hover { border-color: var(--orange-deep); }

        .btn-solid {
          font-family: 'Poppins', sans-serif;
          font-size: 0.88rem; font-weight: 600;
          background: var(--dark); color: var(--cream);
          border: none; padding: 0.7rem 1.2rem;
          cursor: pointer; border-radius: 999px;
          transition: all 0.2s ease;
        }
        .btn-solid:hover { background: var(--orange); }

        .error-msg {
          margin-top: 1.2rem; padding: 0.85rem 1.1rem;
          background: rgba(217, 119, 87, 0.1);
          border: 1px solid var(--orange);
          color: var(--orange-deep);
          border-radius: 12px;
          font-family: 'Lora', Georgia, serif;
          font-style: italic;
        }

        .loading-block {
          margin-top: 1.8rem; padding: 2.2rem 1.5rem;
          text-align: center;
          background: var(--cream-deep);
          border-radius: 16px;
          border: 1px dashed var(--mid);
        }
        .loading-text {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          font-size: 1.1rem; color: var(--dark); margin-top: 1rem;
        }
        .wave-loader {
          display: flex; justify-content: center; gap: 5px;
          align-items: center; height: 50px;
        }
        .wave-loader span {
          width: 4px; background: var(--orange);
          border-radius: 2px;
          animation: wave 1.2s ease-in-out infinite;
        }
        .wave-loader span:nth-child(1) { animation-delay: 0s; }
        .wave-loader span:nth-child(2) { animation-delay: 0.1s; }
        .wave-loader span:nth-child(3) { animation-delay: 0.2s; }
        .wave-loader span:nth-child(4) { animation-delay: 0.3s; }
        .wave-loader span:nth-child(5) { animation-delay: 0.4s; }
        .wave-loader span:nth-child(6) { animation-delay: 0.5s; }
        .wave-loader span:nth-child(7) { animation-delay: 0.6s; }

        @keyframes wave {
          0%, 100% { height: 8px; }
          50% { height: 40px; }
        }
        @keyframes eq-pulse {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }

        .release-card {
          background: var(--cream);
          border: 1px solid var(--light-gray);
          border-radius: 24px;
          padding: 2.5rem;
          margin-bottom: 1.2rem;
          position: relative; overflow: hidden;
        }
        .release-card.dark {
          background: var(--dark); color: var(--cream); border-color: var(--dark);
        }
        .release-card.dark .release-card-label { color: var(--orange-soft); }
        .release-card-label {
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; letter-spacing: 0.18em;
          text-transform: uppercase; font-weight: 600;
          color: var(--orange); margin-bottom: 0.6rem;
          display: flex; align-items: center; gap: 0.5rem;
        }
        .release-title {
          font-family: 'Poppins', sans-serif;
          font-size: clamp(2rem, 5vw, 3.4rem);
          font-weight: 700; line-height: 1;
          letter-spacing: -0.03em; margin-bottom: 0.5rem;
        }
        .release-meta {
          font-family: 'Lora', Georgia, serif; font-style: italic;
          color: var(--mid); font-size: 1rem;
        }
        .style-prompt-text {
          font-family: 'Poppins', sans-serif; font-size: 1rem;
          line-height: 1.6; font-weight: 400;
          color: var(--cream); margin: 1rem 0 1.4rem;
        }

        .fade-in { animation: fade-in 0.6s ease-out both; }
        .fade-in-delay-1 { animation-delay: 0.1s; }
        .fade-in-delay-2 { animation-delay: 0.2s; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .disc {
          position: absolute; top: -60px; right: -60px;
          width: 200px; height: 200px; border-radius: 50%;
          background: var(--orange); opacity: 0.13;
          animation: spin 20s linear infinite;
        }
        .disc::after {
          content: ''; position: absolute;
          top: 50%; left: 50%; width: 30%; height: 30%;
          border-radius: 50%; background: var(--cream);
          transform: translate(-50%, -50%);
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .action-row {
          display: flex; gap: 0.6rem; flex-wrap: wrap;
          align-items: center;
          margin-top: 1.5rem; padding-top: 1.5rem;
          border-top: 1px solid var(--light-gray);
        }

        .dot {
          display: inline-block;
          width: 6px; height: 6px;
          background: var(--orange); border-radius: 50%;
        }

        .footer-note {
          text-align: center; margin-top: 2.5rem;
          font-family: 'Lora', Georgia, serif; font-style: italic;
          font-size: 0.98rem; color: var(--mid); line-height: 1.7;
        }
        .footer-note strong {
          font-family: 'Poppins', sans-serif;
          font-style: normal; font-size: 0.78rem;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--orange); font-weight: 600;
          padding: 0.2rem 0.55rem;
          background: rgba(217, 119, 87, 0.12);
          border-radius: 6px; margin: 0 0.15rem;
        }

        .footer-bar {
          margin-top: 4rem; padding-top: 2rem;
          border-top: 1px solid var(--light-gray);
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'Poppins', sans-serif;
          font-size: 0.72rem; letter-spacing: 0.1em;
          text-transform: uppercase; color: var(--mid); font-weight: 500;
          flex-wrap: wrap; gap: 0.6rem;
        }
        .heart-dot {
          width: 6px; height: 6px;
          background: var(--orange); border-radius: 50%;
          display: inline-block; margin: 0 0.55rem;
          vertical-align: middle;
        }

        @media (max-width: 640px) {
          .release-card { padding: 1.6rem 1.3rem; }
          .generate-block { padding: 1.4rem; }
          .step-header { flex-direction: column; align-items: flex-start; }
          .why-panel { padding: 1.4rem 1.3rem; }
        }
      `}</style>

      <div className="slc-root">
        <div className="slc-content">

          <div className="header-bar">
            <div className="wordmark">
              <div className="logo-mark" />
              <span>Lyric Foundry</span>
            </div>
            <div className="header-right">
              <Equaliser active={loading} />
              <button
                className={`key-pill ${activeKey ? 'ok' : 'missing'}`}
                onClick={() => setShowKeyPanel((v) => !v)}
                title="API key and provider settings"
              >
                <span className="pill-dot" />
                {activeKey
                  ? `${activeProvider.label} · ${keyPreview}${activeProvider.softDailyLimit ? ` · ${todayCount}/${activeProvider.softDailyLimit}` : ''}`
                  : 'Add API key'}
              </button>
              <span className="header-meta">For Suno · v3</span>
            </div>
          </div>

          {showKeyPanel && (
            <div className={`key-panel ${activeKey ? '' : 'warn'}`}>
              <h3>Choose a provider & paste a key {activeKey ? '' : '— required'}</h3>

              <div className="provider-tabs">
                {PROVIDER_ORDER.map((id) => {
                  const p = PROVIDERS[id];
                  const has = !!keys[id];
                  return (
                    <button
                      key={id}
                      className={`provider-tab ${provider === id ? 'active' : ''} ${has ? 'has-key' : ''}`}
                      onClick={() => setProvider(id)}
                    >
                      <span className="provider-tab-name">{p.label}</span>
                      <span className="provider-tab-badge">{p.badge}</span>
                      {has && <span className="provider-tab-check">✓</span>}
                    </button>
                  );
                })}
              </div>

              <p>
                <strong>{activeProvider.label}:</strong> {activeProvider.note} Get a key at{' '}
                <a href={activeProvider.keyUrl} target="_blank" rel="noreferrer">
                  {activeProvider.keyUrl.replace(/^https?:\/\//, '')}
                </a>
                . The key is stored only in your browser's localStorage and is sent directly to {activeProvider.label} —
                never to any server this app controls.
              </p>

              <div className="key-row">
                <input
                  type="password"
                  className="key-input"
                  placeholder={activeProvider.keyHint}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  spellCheck="false"
                  autoCorrect="off"
                  autoCapitalize="none"
                />
                <button className="btn-solid" onClick={saveKey}>
                  {keySaved ? '✓ Saved' : 'Save key'}
                </button>
                {activeKey && (
                  <button className="btn-ghost danger" onClick={clearKey}>
                    Clear
                  </button>
                )}
              </div>
              <div className="key-meta-row">
                <span>Stored in your browser only.</span>
                {activeKey && <span className="saved">✓ Key active · {keyPreview}</span>}
              </div>

              <div className="usage-block">
                <div className="usage-head">
                  <span className="usage-title">Today's usage on this browser</span>
                  <span className="usage-disclaimer">approximate — Google/OpenAI/Groq don't expose remaining-quota directly</span>
                </div>
                <div className="usage-rows">
                  {PROVIDER_ORDER.map((id) => {
                    const p = PROVIDERS[id];
                    const n = usage.counts[id] || 0;
                    const pct = p.softDailyLimit ? Math.min(100, (n / p.softDailyLimit) * 100) : 0;
                    return (
                      <div key={id} className={`usage-row ${rateLimitedProvider === id ? 'limited' : ''}`}>
                        <div className="usage-row-head">
                          <span className="usage-name">{p.label}</span>
                          <span className="usage-count">
                            {p.softDailyLimit
                              ? `${n} / ${p.softDailyLimit} req/day (free tier soft cap)`
                              : `${n} req today · pay-as-you-go`}
                          </span>
                        </div>
                        {p.softDailyLimit && (
                          <div className="usage-bar">
                            <div
                              className={`usage-bar-fill ${pct >= 100 ? 'full' : pct >= 80 ? 'warn' : ''}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        )}
                        {rateLimitedProvider === id && (
                          <div className="usage-limit-msg">
                            ⚠ Provider returned rate-limit (429) on the last request. Switch provider above, or wait for the limit window to reset.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="key-warn">
                <div className="key-warn-head">
                  <span className="warn-badge">!</span>
                  Before you paste a key, read this
                </div>
                <ul>
                  <li>
                    <strong>Treat the key like a password.</strong> Anyone who gets it can spend your Gemini quota
                    (and rack up real charges if you've enabled billing on your Google Cloud project).
                  </li>
                  <li>
                    <strong>Don't use a shared or public computer.</strong> The key sits in <code>localStorage</code>,
                    so anyone with access to this browser profile — or to the DevTools — can read it. Hit{' '}
                    <strong>Clear</strong> before you walk away.
                  </li>
                  <li>
                    <strong>Browser extensions can in theory read it.</strong> Same as on a banking site — a malicious
                    extension with access to this page could exfiltrate any in-page secret. Only paste a key into
                    browsers you trust.
                  </li>
                  <li>
                    <strong>Use a free-tier key, not a billing-enabled one.</strong> Google's free tier on{' '}
                    <em>gemini-2.5-flash</em> has rate limits but won't charge you. If you ever enable Cloud billing,
                    misuse of a leaked key can cost real money.
                  </li>
                  <li>
                    <strong>If something feels off, revoke immediately.</strong> Go to{' '}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">
                      aistudio.google.com/app/apikey
                    </a>{' '}
                    and delete the key. A new one takes ten seconds to generate.
                  </li>
                </ul>
                <p className="key-warn-foot">
                  By saving a key here, you accept that this app is provided as-is with no warranty. The key never
                  leaves your browser and is sent only to Google's official Gemini endpoint — but the security of your
                  device, your browser, and your key is your responsibility.
                </p>
              </div>
            </div>
          )}

          {!result && (
            <>
              <section className="hero fade-in">
                <div className="hero-eyebrow">A small workshop for songs</div>
                <h1 className="hero-title">
                  Write a song you<br/>haven't <em>heard yet.</em>
                </h1>
                <p className="hero-sub">
                  Tell it what the song is about. Pick a feeling, a sound, a shape.
                  Get lyrics formatted for Suno — section tags, style prompt, the lot.
                </p>
                <button
                  className={`why-button ${showWhyBetter ? 'open' : ''}`}
                  onClick={() => setShowWhyBetter((v) => !v)}
                >
                  <span className="why-arrow">→</span>
                  {showWhyBetter ? 'Hide why this beats Suno\'s lyric writer' : 'Why this beats Suno\'s lyric writer'}
                </button>

                {showWhyBetter && (
                  <div className="why-panel">
                    <div className="why-panel-header">The pitch</div>
                    <h3>Suno's built-in lyric writer optimizes for safe. This doesn't.</h3>
                    <ul>
                      <li><strong>Concrete over abstract.</strong> Every line is pushed toward a specific sensory image — the toothbrush in the cup, the second coffee that poured itself — instead of saying "I miss you" twelve times.</li>
                      <li><strong>A 20-cliché blocklist.</strong> "Heart on fire", "dance in the rain", "endless night", "ride or die" and seventeen others are banned at prompt time. Generic lines simply don't get generated.</li>
                      <li><strong>Real narrative architecture.</strong> Verse 2 must reveal something Verse 1 didn't. The Bridge must pivot — change time, perspective, or stakes. Suno's output tends to loop the same emotional note.</li>
                      <li><strong>Hook craft.</strong> The chorus doesn't open by restating the title. Each chorus repeat varies its closing line so the return feels earned, not pasted.</li>
                      <li><strong>Genre-aware prosody.</strong> Trap gets triplet flows and ad-libs. Folk gets balladic meter. Synthwave gets neon-and-highway imagery. The lexicon actually changes per genre — Suno's lyric AI doesn't really know the difference.</li>
                      <li><strong>You drive it.</strong> Subject, genre, mood, structure, free-form notes, and an explicit "style dictates tone" mode. Suno's lyric writer hands you one box.</li>
                      <li><strong>It runs on your key.</strong> Your Gemini key, your quota, your privacy. No middleman.</li>
                    </ul>
                  </div>
                )}
              </section>

              <section className="step fade-in fade-in-delay-1">
                <div className="step-header">
                  <div>
                    <div className="step-num">01 · The Subject</div>
                    <div className="step-title">What is this song about?</div>
                  </div>
                  <div className="step-hint">required</div>
                </div>
                <textarea
                  className="field-textarea"
                  rows={3}
                  placeholder="A late drive home from a wedding you weren't invited to. The way the cat sleeps in the sun. The exact moment a friendship ended."
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                />
              </section>

              <section className="step fade-in fade-in-delay-2">
                <div className="step-header">
                  <div>
                    <div className="step-num">02 · Genre <span className="multi-hint">multi-select</span></div>
                    <div className="step-title">Pick a sonic neighbourhood — or blend a few</div>
                  </div>
                  <div className="step-actions">
                    <button onClick={() => setGenres((g) => addRandomUnused(g, GENRE_CHIPS))} className="surprise-btn">
                      ✦ surprise me
                    </button>
                    {genres.length > 0 && (
                      <button onClick={() => setGenres([])} className="surprise-btn clear-btn">
                        clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="chips">
                  {GENRE_CHIPS.map((g) => (
                    <button
                      key={g}
                      className={`chip ${genres.includes(g) ? 'active' : ''}`}
                      onClick={() => setGenres((cur) => toggleIn(cur, g))}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="custom-input-wrap">
                  <span className="custom-input-label">Or write your own</span>
                  <input
                    type="text"
                    className="field-input custom-input"
                    placeholder="e.g. west-coast g-funk, slowcore, dark cabaret, beach-house hyperpop — comma-separated"
                    value={customGenres}
                    onChange={(e) => setCustomGenres(e.target.value)}
                  />
                </div>
                {(genres.length + splitCustom(customGenres).length) > 1 && (
                  <div className="selection-summary">
                    Blending <strong>{genres.length + splitCustom(customGenres).length}</strong> genres — the prompt will tell the model to fuse them honestly.
                  </div>
                )}
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">03 · Mood <span className="multi-hint">multi-select</span></div>
                    <div className="step-title">How should it feel? Pick as many as fit.</div>
                  </div>
                  <div className="step-actions">
                    <button onClick={() => setMoods((m) => addRandomUnused(m, MOOD_CHIPS))} className="surprise-btn">
                      ✦ surprise me
                    </button>
                    {moods.length > 0 && (
                      <button onClick={() => setMoods([])} className="surprise-btn clear-btn">
                        clear
                      </button>
                    )}
                  </div>
                </div>
                <div className="chips">
                  {MOOD_CHIPS.map((m) => (
                    <button
                      key={m}
                      className={`chip ${moods.includes(m) ? 'active' : ''}`}
                      onClick={() => setMoods((cur) => toggleIn(cur, m))}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div className="custom-input-wrap">
                  <span className="custom-input-label">Or write your own</span>
                  <input
                    type="text"
                    className="field-input custom-input"
                    placeholder="e.g. unbothered, devastating but funny, two-in-the-morning brave — comma-separated"
                    value={customMoods}
                    onChange={(e) => setCustomMoods(e.target.value)}
                  />
                </div>
                {(moods.length + splitCustom(customMoods).length) > 1 && (
                  <div className="selection-summary">
                    Layering <strong>{moods.length + splitCustom(customMoods).length}</strong> moods — they can coexist in the same song.
                  </div>
                )}
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">04 · Structure <span className="multi-hint">multi-select</span></div>
                    <div className="step-title">Choose the song's shape — pick one, or blend several</div>
                  </div>
                  {structures.length > 0 && (
                    <button onClick={() => setStructures([])} className="surprise-btn clear-btn">
                      clear
                    </button>
                  )}
                </div>
                <div className="structure-grid">
                  {STRUCTURES.map((s) => (
                    <button
                      key={s.label}
                      className={`structure-card ${structures.includes(s.value) ? 'active' : ''}`}
                      onClick={() => setStructures((cur) => toggleIn(cur, s.value))}
                    >
                      <span className="s-label">{s.label}</span>
                      <span className="s-value">{s.value}</span>
                    </button>
                  ))}
                </div>
                <div className="custom-input-wrap">
                  <span className="custom-input-label">Or describe your own structure</span>
                  <input
                    type="text"
                    className="field-input custom-input"
                    placeholder="e.g. Intro → Verse → Refrain → Verse → Refrain → Outro Whisper (no chorus)"
                    value={customStructure}
                    onChange={(e) => setCustomStructure(e.target.value)}
                  />
                </div>
                {(structures.length + (customStructure.trim() ? 1 : 0)) > 1 && (
                  <div className="selection-summary">
                    Blending <strong>{structures.length + (customStructure.trim() ? 1 : 0)}</strong> structures — the model will pick one as the spine and let the others inform sections.
                  </div>
                )}

                <div className={`tone-toggle-row ${styleSetsTone ? 'on' : ''}`}>
                  <button
                    type="button"
                    className={`toggle-switch ${styleSetsTone ? 'on' : ''}`}
                    onClick={() => setStyleSetsTone((v) => !v)}
                    aria-pressed={styleSetsTone}
                    aria-label="Let style dictate tone"
                  />
                  <div>
                    <div className="toggle-label">Let style dictate the lyrical tone</div>
                  </div>
                  <div className="toggle-sub">
                    {styleSetsTone
                      ? 'On — genre & mood actively shape vocabulary, rhythm, imagery, and rhyme. Trap heartbreak vs. country heartbreak read like different languages.'
                      : 'Off — genre & mood inform the song but the lyrics keep a restrained literary tone.'}
                  </div>
                </div>
              </section>

              <section className="step">
                <div className="step-header">
                  <div>
                    <div className="step-num">05 · Direction</div>
                    <div className="step-title">
                      Anything else?{' '}
                      <span style={{ color: 'var(--mid)', fontWeight: 400, fontStyle: 'italic', fontFamily: "'Lora', Georgia, serif" }}>
                        (optional)
                      </span>
                    </div>
                  </div>
                </div>
                <textarea
                  className="field-textarea"
                  rows={2}
                  placeholder="vocal style, rhyme scheme, specific lines or images, things to avoid…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </section>

              <div className="generate-block">
                <div className="generate-block-text">
                  <h3>Press the lever.</h3>
                  <p>{activeProvider.label} writes the lyrics. You take them to Suno.</p>
                </div>
                <button
                  className="btn-primary"
                  onClick={generate}
                  disabled={loading}
                >
                  {loading ? 'Composing…' : 'Generate Song'}
                  {!loading && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  )}
                </button>
              </div>

              {rateLimitedProvider && (
                <div className="rate-limit-banner">
                  <div className="rate-limit-head">⚠ {PROVIDERS[rateLimitedProvider].label} rate-limited</div>
                  <div className="rate-limit-body">
                    You're out of free-tier requests for now.{' '}
                    {PROVIDER_ORDER.filter((id) => id !== rateLimitedProvider && keys[id]).length > 0 ? (
                      <>
                        Try switching to{' '}
                        {PROVIDER_ORDER.filter((id) => id !== rateLimitedProvider && keys[id])
                          .map((id) => (
                            <button
                              key={id}
                              className="rate-limit-switch"
                              onClick={() => { setProvider(id); setRateLimitedProvider(null); }}
                            >
                              {PROVIDERS[id].label}
                            </button>
                          ))
                          .reduce((acc, el, i, arr) => acc.concat(i < arr.length - 1 ? [el, ', '] : [el]), [])}
                        {' '}— you already have a key for it.
                      </>
                    ) : (
                      <>
                        Add a key for another provider:{' '}
                        <button className="rate-limit-switch" onClick={() => setShowKeyPanel(true)}>
                          open key panel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {error && <div className="error-msg">{error}</div>}

              {loading && (
                <div className="loading-block">
                  <div className="wave-loader">
                    <span/><span/><span/><span/><span/><span/><span/>
                  </div>
                  <div className="loading-text">{loadingPhrase}…</div>
                </div>
              )}
            </>
          )}

          {result && (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.4rem',
                flexWrap: 'wrap',
                gap: '0.8rem',
              }}>
                <div className="step-num">↳ Fresh from the press</div>
                <button className="btn-ghost" onClick={reset}>← Start over</button>
              </div>

              <div className="release-card fade-in">
                <div className="disc" />
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div className="release-card-label">
                    <span className="dot" />
                    Single · Untitled Project
                  </div>
                  <h2 className="release-title">{result.title}</h2>
                  <div className="release-meta">
                    Written by {activeProvider.label} · {mergedUnique(genres, customGenres).join(' / ') || 'open genre'}
                    {mergedUnique(moods, customMoods).length > 0 && ` · ${mergedUnique(moods, customMoods).join(' / ')}`}
                  </div>
                </div>
              </div>

              <div className="release-card dark fade-in fade-in-delay-1">
                <div className="release-card-label">
                  <span className="dot" />
                  Style of Music — paste into Suno
                </div>
                <div className="style-prompt-text">{result.stylePrompt}</div>
                <button
                  className="btn-ghost"
                  onClick={() => copyText(result.stylePrompt, 'style')}
                  style={{
                    background: copiedStyle ? 'var(--green)' : 'var(--cream)',
                    color: copiedStyle ? 'var(--cream)' : 'var(--dark)',
                    borderColor: copiedStyle ? 'var(--green)' : 'var(--light-gray)',
                  }}
                >
                  {copiedStyle ? '✓ Copied' : 'Copy style prompt'}
                </button>
              </div>

              <div className="release-card fade-in fade-in-delay-2">
                <div className="release-card-label">
                  <span className="dot" />
                  Lyrics — paste into Suno's main field
                </div>
                <div style={{ marginTop: '1.2rem' }}>
                  {renderLyrics(result.lyrics)}
                </div>
                <div className="action-row">
                  <button
                    className={`btn-ghost ${copiedLyrics ? 'copied' : ''}`}
                    onClick={() => copyText(result.lyrics, 'lyrics')}
                  >
                    {copiedLyrics ? '✓ Copied' : 'Copy lyrics'}
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={generate}
                    disabled={loading}
                  >
                    {loading ? 'Re-composing…' : '↻ Regenerate'}
                  </button>
                </div>
              </div>

              <div className="footer-note">
                Drop the lyrics into Suno's main field, the style prompt into <strong>Style of Music</strong>,<br/>
                and the title becomes your song name.
              </div>
            </>
          )}

          <div className="footer-bar">
            <span>Lyric Foundry</span>
            <span>Words by AI<span className="heart-dot" />Songs by you</span>
            <span>Pretoria · {new Date().getFullYear()}</span>
          </div>

        </div>
      </div>
    </>
  );
}
