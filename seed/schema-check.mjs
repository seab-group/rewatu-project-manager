/**
 * Conformance: every emitted table and column must exist in DATA-MODEL-DRAFT.md §3.
 *
 * Asserts against the parsed ERD, never against a magic number. A magic number
 * ("expect 23 files") is how eight unseeded tables stayed hidden in the run that
 * taught this rule — the delta against the source of truth IS the finding.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseErd } from './parse-erd.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, 'out');
const erd = parseErd(join(HERE, '..', 'DATA-MODEL-DRAFT.md'));

const emitted = readdirSync(OUT).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => f.replace(/\.json$/, ''));

const errors = [];
const warnings = [];

// 1. Unknown tables
for (const t of emitted) {
  if (!erd[t]) errors.push(`table '${t}' is emitted but does not exist in the ERD`);
}

// 2. Unknown columns, and columns that exist but are never populated
for (const t of emitted) {
  if (!erd[t]) continue;
  const rows = JSON.parse(readFileSync(join(OUT, `${t}.json`), 'utf8'));
  const seen = new Set();
  for (const row of rows) for (const k of Object.keys(row)) seen.add(k);

  for (const k of seen) {
    if (!erd[t].includes(k)) errors.push(`column '${t}.${k}' is emitted but is not in the ERD`);
  }
  for (const c of erd[t]) {
    if (!seen.has(c)) warnings.push(`column '${t}.${c}' is declared in the ERD but never emitted`);
  }
  // A column present but null in every row renders an empty screen nobody notices.
  for (const c of erd[t]) {
    if (!seen.has(c)) continue;
    if (rows.length && rows.every((r) => r[c] === null || r[c] === '')) {
      warnings.push(`column '${t}.${c}' is null or empty in all ${rows.length} rows`);
    }
  }
}

// 3. Declared but unseeded tables — the delta that matters most
const unseeded = Object.keys(erd).filter((t) => !emitted.includes(t));

console.log(`ERD declares ${Object.keys(erd).length} tables; seed emits ${emitted.length}.`);
if (unseeded.length) {
  console.log(`\nUNSEEDED (${unseeded.length}) — each is a screen that renders empty:`);
  for (const t of unseeded) console.log(`  - ${t}`);
}
if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ~ ${w}`);
}
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`);
  for (const e of errors) console.log(`  ! ${e}`);
  process.exit(1);
}
console.log(`\nconformance: PASS (0 errors)`);
if (unseeded.length) process.exit(2);
