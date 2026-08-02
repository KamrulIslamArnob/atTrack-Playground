import pino from "pino";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true },
        }
      : undefined,
});

export function createExtractionLogger(screenshotId: string, userId: string) {
  const startTime = Date.now();

  return {
    log: logger.child({
      module: "ai-extraction",
      screenshotId,
      userId,
    }),

    start() {
      this.log.info({ status: "pending" }, "Extraction started");
    },

    success(extractedFields: string[]) {
      const duration = Date.now() - startTime;
      this.log.info(
        { status: "success", duration, extractedFields },
        `Extraction completed in ${duration}ms`
      );
      return { duration, extractedFields };
    },

    error(err: unknown) {
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      this.log.error({ status: "error", duration, error: message }, `Extraction failed: ${message}`);
      return { duration, error: message };
    },
  };
}
