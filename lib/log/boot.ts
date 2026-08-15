// Node-only boot work, kept out of instrumentation.ts on purpose.
//
// Next compiles instrumentation.ts for BOTH the nodejs and edge runtimes and
// statically scans each build for Node APIs. A `process.env.NEXT_RUNTIME`
// guard stops the code from RUNNING under edge, but it does not stop the
// scanner from SEEING `process.version` and warning about it on every
// recompile. Moving the Node-touching body here — reachable only through a
// dynamic import inside that guard — keeps the edge bundle clean.

import { log, pruneLogs, LOG_DIR } from "@/lib/log";
import { startDrain } from "@/lib/log/drain";

export async function bootLog(): Promise<void> {
  const { version } = await import("@/package.json");

  pruneLogs();
  log.info(
    { event: "app.boot", version, node: process.version, logDir: LOG_DIR },
    "atTrack server started"
  );

  // No-ops unless ATTRACK_LOG_DRAIN_URL is set: with no drain configured this
  // starts no timer, opens no file and makes no network call.
  startDrain();
}
