import { getPrepared } from '../../prepare/prepare';
import { buildNoncompetitiveIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildNoncompetitiveIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
