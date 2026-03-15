# Sheets

AI math worksheet generator. BYOK, print-ready, free.

> [!CAUTION]
> **This project is largely AI-generated.** Humans direct the architecture, priorities, and design decisions — but this is not a line-by-line audit. There will be bugs, rough edges, and things that don't work perfectly. Use at your own risk.

## What it does

Pick a grade → choose skills (or type any topic) → generate a worksheet with LaTeX math, diagrams, and answer keys. Click any question to edit it with AI. Select questions a student bombed → generate a targeted clinic session. Everything saves locally.

## Run it

```bash
bun install && bun run dev
```

Add your API key in settings. [Gemini](https://aistudio.google.com/apikey) has a free tier. [Claude](https://console.anthropic.com/) is also supported.

## Cost

Gemini Flash: ~1¢/worksheet. Heavy use (5/day): ~$2/month.

## Stack

SvelteKit · Svelte 5 · Tailwind v4 · shadcn-svelte · Vercel AI SDK · KaTeX · Zod

## License

MIT
