# Lyric Foundry

A small workshop for songs. Generates Suno-ready lyrics, section tags, and a style-of-music prompt using Google Gemini.

## Stack

- Vite + React (static frontend)
- Vercel Edge Function at `api/generate.js` proxies Gemini's API so the key stays on the server
- Uses `gemini-2.5-flash` on Google's free tier (no billing required for personal use)

## Setup

1. Get a free Gemini API key from https://aistudio.google.com/app/apikey
2. Install deps:

   ```bash
   npm install
   ```

3. Create `.env.local` (or set as env var in Vercel):

   ```
   GEMINI_API_KEY=your-key-here
   ```

## Develop

```bash
# Full stack with the serverless function (recommended):
npx vercel dev

# Frontend only (won't be able to call /api/generate):
npm run dev
```

## Deploy

Wired for Vercel. Either import the GitHub repo at https://vercel.com/new, or run `npx vercel` from the project root. Add `GEMINI_API_KEY` to the project's Environment Variables before the first deploy.

## Notes

Gemini's free tier has rate limits (per minute / per day). If the app sees real traffic and hits the cap, generation requests will start failing — at that point either upgrade the Google billing tier or swap providers in `api/generate.js`.
