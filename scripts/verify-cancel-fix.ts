export function streamResponseWithReaderCancel(result: {
  baseStream: ReadableStream<Uint8Array>;
  sources: string[];
}): Response {
  const encoder = new TextEncoder();
  const sourcesFrame =
    result.sources.length > 0
      ? encoder.encode(`data: ${JSON.stringify({ sources: result.sources })}\n\n`)
      : new Uint8Array(0);

  let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const mergedStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (sourcesFrame.byteLength > 0) {
        controller.enqueue(sourcesFrame);
      }
      activeReader = result.baseStream.getReader();
      try {
        while (true) {
          const { done, value } = await activeReader.read();
          if (done) break;
          controller.enqueue(value);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        } catch {}
      } finally {
        try {
          activeReader.releaseLock();
        } catch {}
        try {
          controller.close();
        } catch {}
      }
    },
    async cancel(reason) {
      try {
        if (activeReader) {
          await activeReader.cancel(reason);
        } else {
          await result.baseStream.cancel(reason);
        }
      } catch {}
    },
  });

  return new Response(mergedStream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
