#!/usr/bin/env node
/**
 * Fetches the latest humanizer SKILL.md from GitHub and regenerates
 * lib/humanizer-rules.js with the updated content.
 *
 * Usage: node scripts/sync-humanizer.js
 */

import { writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '../lib/humanizer-rules.js');

const RAW_URL =
  'https://raw.githubusercontent.com/blader/humanizer/main/SKILL.md';

async function main() {
  console.log('Fetching humanizer SKILL.md from GitHub...');

  const res = await fetch(RAW_URL);
  if (!res.ok) {
    throw new Error(`GitHub fetch failed: ${res.status} ${res.statusText}`);
  }

  let raw = await res.text();

  // Strip YAML frontmatter (--- ... ---)
  raw = raw.replace(/^---[\s\S]*?---\n/, '');

  // Extract version from frontmatter for the comment
  const versionMatch = await fetch(RAW_URL)
    .then((r) => r.text())
    .then((t) => t.match(/^version:\s*(.+)$/m));
  const version = versionMatch ? versionMatch[1].trim() : 'unknown';

  const output = `// Synced from https://github.com/blader/humanizer (SKILL.md v${version})
// To update: node scripts/sync-humanizer.js

export const HUMANIZER_RULES = ${JSON.stringify(raw.trim())};
`;

  writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Updated lib/humanizer-rules.js (v${version})`);
}

main().catch((err) => {
  console.error('Sync failed:', err.message);
  process.exit(1);
});
