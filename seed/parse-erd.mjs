/**
 * Parses DATA-MODEL-DRAFT.md §3 into { table: [columns] }.
 *
 * This is deliberately mechanical. The ERD is revised between phases, and a
 * generator written from a remembered schema is the failure this guards against:
 * it can be perfectly deterministic and still wrong about most of its tables.
 */
import { readFileSync } from 'node:fs';

const TABLE_HEADING = /^#### `([a-z_]+)`/;
// Anchored to line start so backticked identifiers inside the Notes cell
// (`types.ts:31`, `[inferred]`) can never be mistaken for a column name.
const COLUMN_ROW = /^\| `([a-z_]+)` \|/;

export function parseErd(path) {
  const lines = readFileSync(path, 'utf8').split('\n');

  let inSection3 = false;
  let current = null;
  const tables = {};

  for (const line of lines) {
    if (/^## 3\. Tables/.test(line)) { inSection3 = true; continue; }
    if (inSection3 && /^## 4\./.test(line)) break;
    if (!inSection3) continue;

    const heading = line.match(TABLE_HEADING);
    if (heading) { current = heading[1]; tables[current] = []; continue; }

    if (!current) continue;
    const col = line.match(COLUMN_ROW);
    if (col && !tables[current].includes(col[1])) tables[current].push(col[1]);
  }

  return tables;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const tables = parseErd(process.argv[2] ?? '../DATA-MODEL-DRAFT.md');
  const names = Object.keys(tables).sort();
  console.log(`parsed ${names.length} tables\n`);
  for (const t of names) {
    console.log(`  ${t} (${tables[t].length})`);
    console.log(`      ${tables[t].join(', ')}`);
  }
}
