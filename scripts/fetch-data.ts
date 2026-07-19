// Download the nightly export to .data/bids.json (streamed, not buffered —
// the export is ~24 MB). Skipped entirely when TB_DATA_FILE is set: dev and
// CI builds read that file directly via getPrepared(). Fails non-zero on any
// HTTP or network error so deploy.yml stops before building.
// The main body only runs when invoked directly (node scripts/fetch-data.ts),
// so vitest can import fetchDecision without side effects.
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

export const DEFAULT_URL =
  'https://github.com/CivicTechTO/toronto-bids-data/releases/download/latest/bids.json';
export const DEST = '.data/bids.json';

export type FetchDecision =
  | { mode: 'skip'; file: string }
  | { mode: 'download'; url: string };

// Pure decision logic — unit-tested in tests/prepare/fetch-data.test.ts.
// Empty-string env vars count as unset.
export function fetchDecision(env: Record<string, string | undefined>): FetchDecision {
  const file = env.TB_DATA_FILE;
  if (file !== undefined && file !== '') return { mode: 'skip', file };
  const url = env.TB_DATA_URL !== undefined && env.TB_DATA_URL !== '' ? env.TB_DATA_URL : DEFAULT_URL;
  return { mode: 'download', url };
}

const USAGE = `Usage: node scripts/fetch-data.ts [--help]

Downloads the nightly export to ${DEST}.
  TB_DATA_FILE  when set, skip the download (the build reads this file instead)
  TB_DATA_URL   source URL (default: ${DEFAULT_URL})
Exits 1 on HTTP or network failure.`;

async function main(): Promise<void> {
  if (process.argv.includes('--help')) {
    console.log(USAGE);
    return;
  }
  const decision = fetchDecision(process.env);
  if (decision.mode === 'skip') {
    console.log(`TB_DATA_FILE is set (${decision.file}); skipping download.`);
    return;
  }
  console.log(`Fetching ${decision.url} -> ${DEST}`);
  const res = await fetch(decision.url);
  if (!res.ok || res.body === null) {
    console.error(`Download failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(1);
  }
  await mkdir('.data', { recursive: true });
  await pipeline(Readable.fromWeb(res.body as unknown as WebReadableStream), createWriteStream(DEST));
  console.log(`Wrote ${DEST}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err: unknown) => {
    console.error(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
