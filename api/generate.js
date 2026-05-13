export const config = { runtime: 'edge' };

const MODEL = 'claude-sonnet-4-5';

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response('Server is missing ANTHROPIC_API_KEY', { status: 500 });
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

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt({ theme, genre, mood, structure, notes }) }],
    }),
  });

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return new Response(`Upstream error: ${detail || upstream.status}`, { status: 502 });
  }

  const data = await upstream.json();
  const text = (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
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
