// Smoke test: run each source's fetch() and print event counts + samples.
// Doesn't touch the DB.
//   npx tsx src/scripts/testSources.ts

import { librarySource } from "../lib/sources/library";
import { cityRecSource } from "../lib/sources/cityRec";
import { parksSource } from "../lib/sources/parks";

async function test(s: { id: string; fetch: () => Promise<{ events: unknown[] }> }) {
  const t0 = Date.now();
  try {
    const r = await s.fetch();
    console.log(`✓ ${s.id}: ${r.events.length} events (${Date.now() - t0}ms)`);
    for (const e of r.events.slice(0, 3)) console.log("   ", JSON.stringify(e).slice(0, 250));
  } catch (e) {
    console.log(`✗ ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  await test(librarySource);
  await test(cityRecSource);
  await test(parksSource);
}

main();
