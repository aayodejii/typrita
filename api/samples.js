import { config } from 'dotenv';
config({ path: '.env.local' });

import { list, put, del } from '@vercel/blob';

const ALLOWED_TYPES = ['text/plain', 'text/markdown', 'text/x-markdown'];
const MAX_SIZE_BYTES = 500_000; // 500 KB per sample
const SAMPLE_PREFIX = 'typrita-samples/';

const blobToken = () => process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    if (req.method === 'GET') {
      return await listSamples(req, res);
    }
    if (req.method === 'POST') {
      return await uploadSample(req, res);
    }
    if (req.method === 'DELETE') {
      return await deleteSample(req, res);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[samples]', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function listSamples(req, res) {
  const { blobs } = await list({ prefix: SAMPLE_PREFIX, token: blobToken() });
  const samples = blobs.map((b) => ({
    name: b.pathname.replace(SAMPLE_PREFIX, ''),
    pathname: b.pathname,
    url: b.url,
    size: b.size,
    uploadedAt: b.uploadedAt,
  }));
  return res.status(200).json({ samples });
}

async function uploadSample(req, res) {
  const contentType = req.headers['content-type'] || '';
  const filename = req.headers['x-filename'];

  if (!filename) {
    return res.status(400).json({ error: 'Missing x-filename header' });
  }

  const mimeType = contentType.split(';')[0].trim();
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: 'Only .txt and .md files are accepted' });
  }

  let body;
  if (req.body) {
    body = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  } else {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    body = Buffer.concat(chunks);
  }

  const totalSize = body.length;
  if (totalSize > MAX_SIZE_BYTES) {
    return res.status(413).json({ error: 'File too large. Maximum size is 500 KB.' });
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._\-]/g, '_');
  const pathname = `${SAMPLE_PREFIX}${safeName}`;

  const blob = await put(pathname, body, {
    access: 'private',
    contentType: mimeType,
    addRandomSuffix: false,
    token: blobToken(),
  });

  return res.status(201).json({ blob });
}

async function deleteSample(req, res) {
  const { pathname } = req.query;

  if (!pathname) {
    return res.status(400).json({ error: 'Missing pathname query parameter' });
  }

  if (!pathname.startsWith(SAMPLE_PREFIX)) {
    return res.status(400).json({ error: 'Invalid pathname' });
  }

  await del(pathname, { token: blobToken() });
  return res.status(200).json({ ok: true });
}
