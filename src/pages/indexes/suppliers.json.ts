import { getPrepared } from '../../prepare/prepare';
import { buildSupplierIndex } from '../../prepare/indexes';

export async function GET() {
  const p = await getPrepared();
  return new Response(JSON.stringify(buildSupplierIndex(p)), {
    headers: { 'Content-Type': 'application/json' },
  });
}
