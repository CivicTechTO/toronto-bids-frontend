import { getPrepared } from '../../prepare/prepare';
import { buildSolicitationIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildSolicitationIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
