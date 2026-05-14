// Run a refresh from the command line. Useful while developing.
//   POSTGRES_URL=... npx tsx src/scripts/refreshLocal.ts

import { runAllSources } from "../lib/sources";
import { refreshAllCachedBuckets } from "../lib/weather";

async function main() {
  console.log("Refreshing weather…");
  const buckets = await refreshAllCachedBuckets();
  for (const b of buckets) {
    if (b.ok) {
      console.log(`  ✓ ${b.lat},${b.lng}: ${b.periods} hourly periods`);
    } else {
      console.log(`  ✗ ${b.lat},${b.lng}: ${b.error}`);
    }
  }

  console.log("Refreshing sources…");
  const results = await runAllSources();
  for (const r of results) {
    if (r.ok) {
      console.log(`  ✓ ${r.sourceId}: ${r.eventCount} events (${r.durationMs}ms)`);
    } else {
      console.log(`  ✗ ${r.sourceId}: ${r.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
