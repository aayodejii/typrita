import { config } from 'dotenv';
config({ path: '.env.local' });

import Anthropic from '@anthropic-ai/sdk';
import { list, get as blobGet } from '@vercel/blob';
import { HUMANIZER_RULES } from '../lib/humanizer-rules.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const SAMPLE_PREFIX = 'typrita-samples/';

const VOICE_CALIBRATION_LAYER = `
Beyond eliminating AI patterns, calibrate your output to match the specific voice found in the writing samples provided below. These are the user's own words. Study and internalize:
- Their sentence length patterns (short and direct? long and flowing? mixed?)
- Their vocabulary range and specific word preferences
- How they open and close paragraphs
- Their punctuation habits (fragments? semicolons? parentheticals?)
- Their level of formality and any characteristic phrases
- Whether they lean toward directness or nuance
- How they handle transitions

Do not copy their sentences. Absorb their style and write in it.
`.trim();

const TASK_LAYER = `
Determine which mode applies from the user's input:

MODE A — REWRITE: The input is existing text (article, email, post, paragraph). Rewrite it to strip every AI signature listed above and match the calibrated voice. Preserve all original meaning and information. Do not add new claims.

MODE B — GENERATE: The input is a topic, brief, outline, or description. Write the full piece from scratch. Match the calibrated voice. Apply all humanizer rules throughout.

In both modes: output the final text only. No preamble, no "Here is your rewritten text:", no explanation. Just the result.
`.trim();

async function fetchSampleContents() {
  const { blobs } = await list({ prefix: SAMPLE_PREFIX, token: process.env.BLOB_READ_WRITE_TOKEN });
  if (blobs.length === 0) return null;

  const fetched = await Promise.all(
    blobs.map(async (blob) => {
      const result = await blobGet(blob.pathname, {
        access: 'private',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      if (!result || result.statusCode !== 200) return null;
      const text = await new Response(result.stream).text();
      const name = blob.pathname.replace(SAMPLE_PREFIX, '');
      return `<sample name="${name}">\n${text.slice(0, 8000)}\n</sample>`;
    })
  );

  return fetched.filter(Boolean).join('\n\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    if (req.body) {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { prompt } = body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or empty prompt' });
  }

  let sampleContent;
  try {
    sampleContent = await fetchSampleContents();
    console.log('[generate] samples loaded:', sampleContent ? 'yes' : 'no');
  } catch (err) {
    console.error('[generate] Failed to fetch samples:', err);
    return res.status(500).json({ error: 'Failed to load writing samples' });
  }

  const systemParts = [HUMANIZER_RULES, '\n\n'];

  if (sampleContent) {
    systemParts.push(VOICE_CALIBRATION_LAYER);
    systemParts.push('\n\n<user_samples>\n');
    systemParts.push(sampleContent);
    systemParts.push('\n</user_samples>\n\n');
  } else {
    systemParts.push(
      'No writing samples have been provided. Apply the humanizer rules and write in a clear, natural, direct voice with genuine personality.\n\n'
    );
  }

  systemParts.push(TASK_LAYER);

  const systemPrompt = systemParts.join('');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt.trim() }],
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        const chunk = event.delta.text.replace(/\n/g, '\\n');
        res.write(`data: ${chunk}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('[generate] Stream error:', err);
    res.write(`data: [ERROR] ${err.message}\n\n`);
    res.end();
  }
}
