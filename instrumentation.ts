// Next.js instrumentation hook: runs once per server process, before any
// request is served, and catches server errors Next would otherwise only
// print to the console.
//
// Nothing that touches a Node API may appear in this file. Next compiles it
// for the edge runtime as well as nodejs and statically scans that build, so
// even code guarded by NEXT_RUNTIME warns if the scanner can see it. The
// Node-only work lives in lib/log/boot.ts, behind the dynamic import below.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { bootLog } = await import("@/lib/log/boot");
  await bootLog();
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
