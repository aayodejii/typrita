# Typrita

Typrita takes text that sounds like it was written by a language model and rewrites it to match how you actually write. Or it writes something from scratch that sounds like you. Either way, it needs to know your voice first.

## How it works

There are two views.

The **Editor** is where you work. Paste in text you want stripped of AI patterns, or describe what you want written from scratch. Pick a mode, hit generate, copy the output.

The **Sample Locker** is where you teach it your voice. Upload `.txt` or `.md` files of your own writing. These get stored and referenced every time you generate something.

Two modes:

- **Rewrite** takes whatever you paste in and removes the AI signatures. The flat rhythm, the em dashes, the "delve into" and "tapestry of" and "it is important to note." What comes out reads like a person wrote it.
- **Generate** writes a full piece from scratch, calibrated to sound like you based on your samples.

The output streams in as it's generated. No waiting for a full page to load before you see anything.

## Stack

- Vanilla HTML, CSS, and JS on the frontend
- Vercel Serverless Functions (Node.js ESM) for the API
- Vercel Blob for sample storage
- Claude via the Anthropic SDK for generation
- Streaming SSE for output

## Local setup

Node 18 or higher is required.

```bash
npm install
```

Create a Vercel Blob store in your project settings, then pull the environment variables:

```bash
vercel env pull .env.local
```

Add your Anthropic API key to `.env.local`:

```
ANTHROPIC_API_KEY=your_key_here
```

Get one at [console.anthropic.com](https://console.anthropic.com).

Start the dev server:

```bash
vercel dev
```

### Environment variables

| Variable | Where it comes from |
|---|---|
| `BLOB_READ_WRITE_TOKEN` | Pulled automatically via `vercel env pull` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |

## Deploy

```bash
vercel deploy
```

Add `ANTHROPIC_API_KEY` in your Vercel project settings under Environment Variables.

## Keeping the humanizer rules current

The rewrite logic uses a set of rules for detecting and removing AI writing patterns. These are synced from [github.com/blader/humanizer](https://github.com/blader/humanizer). To pull the latest version:

```bash
node scripts/sync-humanizer.js
```

## License

MIT
