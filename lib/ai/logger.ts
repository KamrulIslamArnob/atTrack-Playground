import { moduleLogger } from "@/lib/log";

const log = moduleLogger("ai.extraction");

/** Start/success/error for one screenshot extraction, sharing a duration
 *  clock. Field names are unchanged from the console version this replaced,
 *  so anything already filtering on `[ai-extraction]` still matches. */
export function createExtractionLogger(screenshotId: string, userId: string) {
  const startTime = Date.now();

  return {
    start() {
      log.info(
        { event: "ai.extraction", screenshotId, userId, status: "pending" },
        "[ai-extraction] Extraction started"
      );
    },

    success(extractedFields: string[]) {
      const duration = Date.now() - startTime;
      log.info(
        { event: "ai.extraction", screenshotId, userId, status: "success", duration, extractedFields },
        `[ai-extraction] Extraction completed in ${duration}ms`
      );
      return { duration, extractedFields };
    },

    error(err: unknown) {
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      log.error(
        { event: "ai.extraction", screenshotId, userId, status: "error", duration, err },
        `[ai-extraction] Extraction failed: ${message}`
      );
      return { duration, error: message };
    },
  };
}
