export const config = { runtime: 'edge' };

const MODEL = 'gemini-2.5-flash';

function buildPrompt({ theme, genre, mood, structure, notes }) {
  return `Write song lyrics formatted for Suno AI.

Subject: ${theme}
Genre: ${genre || 'choose what fits'}
Mood: ${mood || 'fitting to the subject'}
Structure: ${structure}
Additional direction: ${notes || 'none'}

Respond with ONLY valid JSON, no markdown fences, no preamble:
{
  "title": "evocative song title",
  "lyrics": "full lyrics with Suno section tags",
  "stylePrompt": "comma-separated style descriptors under 200 chars"
}

Rules for "lyrics":
- Use Suno section tags in square brackets, each on its own line: [Intro], [Verse], [Verse 2], [Pre-Chorus], [Chorus], [Bridge], [Outro], [Instrumental], [Guitar Solo], etc.
- Blank line between sections
- Numbered verses ([Verse 1], [Verse 2]) when multiple verses exist
- Real, singable lines — concrete images, not vague abstractions
- Aim for a full song (~250-350 words of lyric content)

Rules for "stylePrompt":
- Comma-separated descriptors for Suno's "Style of Music" field
- Include genre, vocal style/gender if relevant, instrumentation, production texture, tempo feel
- Example: "indie folk, melancholic female vocals, fingerpicked acoustic guitar, intimate, lo-fi production"
- Under 200 characters
- Don't include artist names`;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response('Server is missing GEMINI_API_KEY', { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { theme, genre, mood, structure, notes } = body || {};
  if (!theme || typeof theme !== 'string' || !theme.trim()) {
    return new Response('Missing "theme"', { status: 400 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const upstream = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt({ theme, genre, mood, structure, notes }) }] }],
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
        maxOutputTokens: 4096,
        temperature: 0.95,
      },
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return new Response(`Upstream error: ${detail || upstream.status}`, { status: 502 });
  }

  const data = await upstream.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .replace(/```json|```/g, '')
    .trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return new Response('Model returned non-JSON output', { status: 502 });
  }

  return new Response(JSON.stringify(parsed), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
