// Run a refresh from the command line. Useful while developing.
//   POSTGRES_URL=... npx tsx src/scripts/refreshLocal.ts

import { runAllSources } from "../lib/sources";
import { refreshWeather } from "../lib/weather";

async function main() {
  console.log("Refreshing weather…");
  const periods = await refreshWeather();
  console.log(`  ${periods.length} hourly periods cached`);

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
