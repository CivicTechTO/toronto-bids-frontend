// src/pages/counts.json.ts — entity counts of THIS deploy; the next deploy's
// shrink-guard fetches this from the live site.
import { getPrepared } from '../prepare/prepare';

export async function GET(): Promise<Response> {
  const p = await getPrepared();
  return new Response(JSON.stringify(p.counts), {
    headers: { 'Content-Type': 'application/json' },
  });
}
