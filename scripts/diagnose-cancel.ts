import { streamResponse } from "../lib/ai-chatbot/pipeline";

async function diagnose() {
  let cancelCalled = false;
  let cancelError: unknown = null;

  const baseStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("data: hello\n\n"));
    },
    cancel(reason) {
      cancelCalled = true;
      console.log("baseStream cancel hook invoked with reason:", reason);
    },
  });

  const res = streamResponse({
    mode: "stream",
    baseStream,
    sources: [],
  });

  const body = res.body!;
  console.log("Cancelling response.body...");
  try {
    await body.cancel("test abort");
  } catch (e) {
    console.error("body.cancel threw:", e);
  }

  await new Promise((r) => setTimeout(r, 50));
  console.log("baseStream locked?", baseStream.locked);
  console.log("cancelCalled?", cancelCalled);
}

diagnose();
