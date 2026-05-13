# Lyric Foundry

A small workshop for songs. Generates Suno-ready lyrics, section tags, and a style-of-music prompt using Claude.

## Stack

- Vite + React (static frontend)
- Vercel Edge Function at `api/generate.js` proxies Anthropic's API so the key stays on the server

## Setup

```bash
npm install
```

Create `.env.local` (or set env vars in Vercel):

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Develop

```bash
# Frontend only (the /api proxy needs the Vercel dev server)
npm run dev

# Full stack with the serverless function:
npx vercel dev
```

## Deploy

This project is wired for Vercel. Push to GitHub and import the repo in Vercel, or run `npx vercel`. Add `ANTHROPIC_API_KEY` to the project's environment variables.
