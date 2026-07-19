import { getPrepared } from '../../prepare/prepare';
import { buildCouncilIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildCouncilIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
