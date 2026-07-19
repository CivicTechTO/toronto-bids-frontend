// Deploy gate: refuse to build when the fresh export shrank >20% vs the
// previous deploy's published counts. Run by deploy.yml after fetch-data and
// the counts.json download, before `npm run build`.
//   Reads: .data/bids.json                 (required — the fresh export)
//          .data/previous-counts.json      (optional — absent on first deploy)
//   Exit:  0 with counts printed, or 1 listing every violation.
import { existsSync, readFileSync } from 'node:fs';
import { validateExport } from '../src/prepare/validate.ts';
import { checkShrink, countsOf } from '../src/prepare/guard.ts';

const doc = validateExport(JSON.parse(readFileSync('.data/bids.json', 'utf8')));
const current = countsOf(doc);
const previous: Record<string, number> | null = existsSync('.data/previous-counts.json')
  ? (JSON.parse(readFileSync('.data/previous-counts.json', 'utf8')) as Record<string, number>)
  : null;
if (previous === null) {
  console.log('No previous counts found (first deploy?) — shrink guard skipped.');
}
const violations = checkShrink(previous, current);
if (violations.length > 0) {
  console.error('Shrink guard FAILED — refusing to deploy:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(`Shrink guard OK. Counts: ${JSON.stringify(current)}`);
