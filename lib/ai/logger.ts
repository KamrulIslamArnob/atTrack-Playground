export function createExtractionLogger(screenshotId: string, userId: string) {
  const startTime = Date.now();

  return {
    start() {
      console.info("[ai-extraction]", { screenshotId, userId, status: "pending" }, "Extraction started");
    },

    success(extractedFields: string[]) {
      const duration = Date.now() - startTime;
      console.info(
        "[ai-extraction]",
        { screenshotId, userId, status: "success", duration, extractedFields },
        `Extraction completed in ${duration}ms`
      );
      return { duration, extractedFields };
    },

    error(err: unknown) {
      const duration = Date.now() - startTime;
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        "[ai-extraction]",
        { screenshotId, userId, status: "error", duration, error: message },
        `Extraction failed: ${message}`
      );
      return { duration, error: message };
    },
  };
}

