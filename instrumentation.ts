// Next.js instrumentation hook: runs once per server process, before any
// request is served, and catches server errors Next would otherwise only
// print to the console.

export async function register(): Promise<void> {
  // Guard the runtime even though every route in this app is `nodejs` —
  // instrumentation is also evaluated for the edge runtime, where node:fs
  // does not exist and importing the logger would throw at boot.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { log, pruneLogs, LOG_DIR } = await import("@/lib/log");
  const { version } = await import("@/package.json");

  pruneLogs();
  log.info(
    { event: "app.boot", version, node: process.version, logDir: LOG_DIR },
    "atTrack server started"
  );
}

/** Next calls this for every uncaught server-side error, including ones
 *  thrown inside Server Components and Server Actions where there is no
 *  route handler to wrap. */
export async function onRequestError(
  err: unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; renderSource?: string }
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { log } = await import("@/lib/log");
  log.error(
    {
      event: "app.error",
      path: request?.path,
      method: request?.method,
      routePath: context?.routePath,
      renderSource: context?.renderSource,
      err,
    },
    "Unhandled server error"
  );
}
