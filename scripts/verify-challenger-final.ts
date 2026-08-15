import {
  loadChatContext,
  retrieveChatContext,
  executeAgent,
  streamResponse,
  isSourceAllowed,
  selectProviderForModel,
  formatConversationHistory,
  type ChatPipelineInput,
  type LoadedChatContext,
  type RetrievedChatContext,
} from "../lib/ai-chatbot/pipeline";
import {
  buildGroundedContext,
  assembleGroundedSystemPrompt,
} from "../lib/ai-chatbot/grounded-context";
import { assembleChatSystemPrompt } from "../lib/ai-chatbot/prompt";
import { registerAgent, getAgent } from "../lib/ai/agents/registry";
import { getTool, TOOL_REGISTRY } from "../lib/ai/tools/registry";
import type { AgentDefinition } from "../lib/ai/agents/types";
import type { RetrievedDoc } from "../lib/ai-chatbot/retrieval/types";

interface TestReport {
  name: string;
  category: string;
  passed: boolean;
  error?: string;
  details?: unknown;
}

const reports: TestReport[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, category: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    reports.push({ name, category, passed: true });
    console.log(`  [PASS] [${category}] ${name}`);
  } catch (err: any) {
    reports.push({ name, category, passed: false, error: err?.message || String(err) });
    console.error(`  [FAIL] [${category}] ${name}: ${err?.message || err}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("STARTING EMPIRICAL CHALLENGER VERIFICATION SUITE");
  console.log("================================================================================\n");

  // ============================================================================
  // ITEM 1: Safe Role Mapping on History Messages
  // ============================================================================
  await runTest(
    "loadChatContext handles missing role, nullish items, and malformed messages safely",
    "Item 1: Safe Role Mapping",
    async () => {
      // 1. Missing role
      const input1: ChatPipelineInput = {
        userId: "test-user-1",
        personaId: "general",
        messages: [
          { content: "Hello without role" } as any,
          { role: "user", content: "What is my next task?" },
        ],
      };
      const ctx1 = await loadChatContext(input1);
      assert(ctx1.baseSystemPrompt.includes("USER: Hello without role"), "Defaulted missing role to USER");

      // 2. Null/undefined items and non-string content
      const input2: ChatPipelineInput = {
        userId: "test-user-1",
        personaId: "general",
        messages: [
          null as any,
          undefined as any,
          { role: "assistant", content: "I am ready." },
          { role: "user", content: 12345 as any }, // Non-string content should be filtered
          { role: undefined as any, content: "Implicit role message" },
          { role: "user", content: "Final prompt" },
        ],
      };
      const ctx2 = await loadChatContext(input2);
      assert(ctx2.baseSystemPrompt.includes("ASSISTANT: I am ready."), "Includes valid assistant message");
      assert(ctx2.baseSystemPrompt.includes("USER: Implicit role message"), "Defaulted undefined role to USER");
      assert(!ctx2.baseSystemPrompt.includes("12345"), "Filtered non-string content message");
      assert(ctx2.userPrompt === "Final prompt", "Extracted final userPrompt properly");

      // 3. Completely empty messages
      const input3: ChatPipelineInput = {
        userId: "test-user-1",
        personaId: "general",
        messages: [],
      };
      const ctx3 = await loadChatContext(input3);
      assert(ctx3.userPrompt === "Hello.", "Defaults empty messages to 'Hello.'");
    }
  );

  // ============================================================================
  // ITEM 2: Deduplicated Directives in Grounded Context & System Prompt
  // ============================================================================
  await runTest(
    "assembleGroundedSystemPrompt does not duplicate web search or sqlite database directives",
    "Item 2: Prompt Deduplication",
    () => {
      const baseSystemPrompt = assembleChatSystemPrompt({
        persona: {
          id: "general",
          name: "General Assistant",
          badge: "Specialist",
          iconName: "Sparkles",
          description: "Helpful career assistant",
          systemPrompt: "You are an assistant.",
          heading: "General",
          subheading: "Assistant",
          preferredSources: ["jobs"],
        },
        personaPrompt: null,
        conversationHistory: "USER: Hello",
        workspaceContext: "Some workspace context",
        webSearchActive: true,
      });

      // Verify base prompt contains exactly 1 occurrence of directives
      const webMatchesBase = baseSystemPrompt.match(/--- WEB SEARCH ACTIVE ---/g);
      const dbMatchesBase = baseSystemPrompt.match(/--- LOCAL SQLITE TABLES ---/g);
      assert(webMatchesBase?.length === 1, "Base prompt has 1 web search directive block");
      assert(dbMatchesBase?.length === 1, "Base prompt has 1 sqlite directive block");

      const mockDocs: RetrievedDoc[] = [
        {
          id: "job-1",
          citeRef: "job-1",
          source: "jobs",
          title: "Frontend Engineer @ Stripe",
          text: "Status: Applied, Salary: $180k",
        },
      ];
      const groundedContext = buildGroundedContext(mockDocs);
      assert(groundedContext !== null, "buildGroundedContext returns formatted string");

      const groundedPrompt = assembleGroundedSystemPrompt({
        baseSystemPrompt,
        groundedContext,
        webSearchActive: true,
      });

      // Verify grounded prompt did NOT duplicate directives
      const webMatchesGrounded = groundedPrompt.match(/--- WEB SEARCH ACTIVE ---/g);
      const dbMatchesGrounded = groundedPrompt.match(/--- LOCAL SQLITE TABLES ---/g);
      assert(
        webMatchesGrounded?.length === 1,
        `Expected exactly 1 web search directive block in grounded prompt, got ${webMatchesGrounded?.length}`
      );
      assert(
        dbMatchesGrounded?.length === 1,
        `Expected exactly 1 sqlite directive block in grounded prompt, got ${dbMatchesGrounded?.length}`
      );

      // Verify accuracy rules are present
      assert(groundedPrompt.includes("ACCURACY RULES (critical):"), "Includes accuracy rules");
      assert(groundedPrompt.includes("=== USER WORKSPACE DATA"), "Includes workspace data");
      assert(groundedPrompt.includes("[src:job-1] Frontend Engineer @ Stripe"), "Includes citation tags");
    }
  );

  // ============================================================================
  // ITEM 3: Try/Catch on Dynamic Agent System Prompt Functions
  // ============================================================================
  await runTest(
    "retrieveChatContext catches throwing dynamic agent systemPrompt without crashing pipeline",
    "Item 3: Dynamic Prompt Resilience",
    async () => {
      // Register an agent with a faulty dynamic prompt generator
      const faultyAgentId = `faulty-agent-${Date.now()}`;
      registerAgent({
        id: faultyAgentId,
        name: "Faulty Agent",
        description: "Agent whose prompt generator throws",
        tools: [],
        systemPrompt: (ctx) => {
          throw new Error("Deliberate failure in dynamic prompt generation!");
        },
      });

      const loadedCtx: LoadedChatContext = {
        input: {
          userId: "user-1",
          personaId: faultyAgentId,
          messages: [{ role: "user", content: "Test throwing agent" }],
        },
        messagesArray: [{ role: "user", content: "Test throwing agent" }],
        userPrompt: "Test throwing agent",
        historyMessages: [],
        hasImages: false,
        agent: getAgent(faultyAgentId),
        selectedPersona: {
          id: faultyAgentId,
          name: "Faulty Agent",
          badge: "Test",
          iconName: "Bug",
          description: "Faulty",
          systemPrompt: "Base prompt for faulty",
          heading: "Faulty",
          subheading: "Test",
          preferredSources: [],
        },
        baseSystemPrompt: "Base system prompt content",
        chain: [],
      };

      // Execution must NOT throw
      const retrieved = await retrieveChatContext(loadedCtx);
      assert(retrieved.finalSystemPrompt.includes("Base system prompt content"), "Retained base system prompt");
      assert(!retrieved.finalSystemPrompt.includes("Deliberate failure"), "Did not corrupt prompt");

      // Register an agent with a successful dynamic prompt generator
      const validAgentId = `valid-dynamic-agent-${Date.now()}`;
      registerAgent({
        id: validAgentId,
        name: "Dynamic Agent",
        description: "Agent with dynamic prompt",
        tools: [],
        systemPrompt: (ctx) => `DYNAMIC_DIRECTIVE_FOR_${ctx.userId}`,
      });

      loadedCtx.agent = getAgent(validAgentId);
      const retrievedValid = await retrieveChatContext(loadedCtx);
      assert(
        retrievedValid.finalSystemPrompt.includes("DYNAMIC_DIRECTIVE_FOR_user-1"),
        "Dynamic prompt successfully appended when function succeeds"
      );
    }
  );

  // ============================================================================
  // ITEM 4: Preserved Executed Tool Calls on Empty Text
  // ============================================================================
  await runTest(
    "streamResponse formats executed tool calls properly even if toolResultText is empty",
    "Item 4: Preserved Tool Calls on Empty Text",
    async () => {
      const executedCalls = [
        {
          name: "searchJobs",
          args: { status: "interviewing" },
          status: "done" as const,
          summary: "Found 2 matching jobs",
          result: { content: "Google, Meta", citations: ["job-1", "job-2"] },
        },
      ];

      // Empty text with executed tool calls
      const executionResult = {
        mode: "tools" as const,
        toolResultText: "",
        executedToolCalls: executedCalls,
        sources: ["jobs"],
      };

      const response = streamResponse(executionResult);
      assert(Boolean(response.headers.get("Content-Type")?.includes("text/event-stream")), "Returns SSE Content-Type");

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      const frames = fullText.split("\n\n").filter(Boolean);
      assert(frames.length >= 3, `Expected at least 3 frames, got ${frames.length}`);

      // Frame 1: tool_calls
      const toolCallFrame = JSON.parse(frames[0].replace(/^data: /, ""));
      assert(toolCallFrame.tool_calls.length === 1, "Tool call frame present and preserved");
      assert(toolCallFrame.tool_calls[0].name === "searchJobs", "Correct tool call name");

      // Frame 2: sources
      const sourcesFrame = JSON.parse(frames[1].replace(/^data: /, ""));
      assert(sourcesFrame.sources[0] === "jobs", "Sources frame present");

      // Last frame: [DONE]
      const lastFrame = frames[frames.length - 1].replace(/^data: /, "").trim();
      assert(lastFrame === "[DONE]", `Last frame is [DONE], got ${lastFrame}`);
    }
  );

  // ============================================================================
  // ITEM 5: Stream Cancellation via activeReader?.cancel(reason)
  // ============================================================================
  await runTest(
    "streamResponse supports clean stream cancellation without throwing locked stream error",
    "Item 5: Stream Cancellation",
    async () => {
      let baseStreamCancelledWith: unknown = null;
      let intervalId: any = null;

      const baseStream = new ReadableStream<Uint8Array>({
        start(controller) {
          const encoder = new TextEncoder();
          let count = 0;
          intervalId = setInterval(() => {
            if (count >= 100) {
              clearInterval(intervalId);
              try { controller.close(); } catch {}
              return;
            }
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `chunk-${count++}` } }] })}\n\n`)
              );
            } catch {
              clearInterval(intervalId);
            }
          }, 10);
        },
        cancel(reason) {
          clearInterval(intervalId);
          baseStreamCancelledWith = reason;
        },
      });

      const response = streamResponse({
        mode: "stream",
        baseStream,
        sources: ["contacts"],
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      // Read initial sources frame + 1 chunk
      const first = await reader.read();
      assert(!first.done, "Received first frame (sources)");
      const firstStr = decoder.decode(first.value);
      assert(firstStr.includes("contacts"), "Sources frame received");

      const second = await reader.read();
      assert(!second.done, "Received second frame (data chunk)");

      // Trigger cancel on outer stream
      await reader.cancel("Client disconnected prematurely");

      // Allow event loop to process async cleanup
      await new Promise((r) => setTimeout(r, 50));

      assert(
        baseStreamCancelledWith === "Client disconnected prematurely",
        `Base stream should receive cancellation reason, got: ${baseStreamCancelledWith}`
      );
    }
  );

  // ============================================================================
  // ITEM 6: Tool Authorization & Gating & Source Perms
  // ============================================================================
  await runTest(
    "isSourceAllowed enforces fine-grained source permission gating and cross-aliasing",
    "Item 6: Tool Source Gating",
    () => {
      assert(isSourceAllowed("jobs", ["jobs", "resumes"]) === true, "Allowed when in list");
      assert(isSourceAllowed("contacts", ["jobs"]) === false, "Disallowed when not in list");
      assert(isSourceAllowed("links", ["contacts"]) === true, "Links allowed when contacts enabled");
      assert(isSourceAllowed("contacts", ["links"]) === true, "Contacts allowed when links enabled");
      assert(isSourceAllowed(undefined, ["jobs"]) === true, "Undefined source is unrestricted (e.g. webSearch)");
      assert(isSourceAllowed("jobs", undefined) === true, "Undefined enabledSourceIds allows all");
    }
  );

  // ============================================================================
  // ITEM 7: Provider/model routing — never send a model id to a provider that
  // has not claimed it. Both cases below were observed as live 400s.
  // ============================================================================
  await runTest(
    "selectProviderForModel routes to the provider that owns the model, never stamping ids",
    "Item 7: Model Routing",
    () => {
      const mk = (id: string, type: "gemini" | "anthropic" | "openai_compatible", model: string) =>
        ({ id, name: id, provider_type: type, base_url: null, model, api_key: "k" }) as any;

      // Regression: "Unsupported model (model=models/gemini-3.6-flash)" — the
      // picker lists each provider's own model, so an exact match must promote
      // that provider rather than stamping the id onto the chain head.
      const c1 = [mk("longcat", "openai_compatible", "LongCat-Flash"), mk("gem", "gemini", "models/gemini-3.6-flash")];
      const r1 = selectProviderForModel(c1, "models/gemini-3.6-flash");
      assert(r1[0].id === "gem", "Exact model match must promote its owning provider");
      assert(r1[0].model === "models/gemini-3.6-flash", "Promoted provider keeps its own model");
      assert(r1.length === 2 && r1[1].id === "longcat", "Remaining fallback order is preserved");

      // Regression: "Unsupported model (model=claude-3-5-sonnet-20241022)" sent
      // to an OpenAI-compatible endpoint by the auto-router.
      const c2 = [mk("longcat", "openai_compatible", "LongCat-Flash")];
      const r2 = selectProviderForModel(c2, "claude-3-5-sonnet");
      assert(r2[0].model === "LongCat-Flash", "No Anthropic provider: must not stamp a Claude id");

      // Auto-router shorthand WITH a matching vendor present.
      const c3 = [mk("longcat", "openai_compatible", "LongCat-Flash"), mk("ant", "anthropic", "claude-3-haiku")];
      const r3 = selectProviderForModel(c3, "claude-3-5-sonnet");
      assert(r3[0].id === "ant", "Anthropic target promotes the Anthropic provider");
      assert(r3[0].model === "claude-3-5-sonnet-20241022", "Catalog id applied for an unambiguous vendor");

      // openai_compatible spans many vendors, so the type alone proves nothing.
      const c4 = [mk("groq", "openai_compatible", "llama-3.3-70b")];
      const r4 = selectProviderForModel(c4, "gpt-4o");
      assert(r4[0].model === "llama-3.3-70b", "openai_compatible keeps its configured model");

      // Unknown id nobody claims, and the empty/no-target guards.
      assert(selectProviderForModel([mk("a", "gemini", "m")], "nope")[0].model === "m", "Unknown id leaves chain intact");
      assert(selectProviderForModel([], "gpt-4o").length === 0, "Empty chain is safe");
      assert(selectProviderForModel([mk("a", "gemini", "m")], undefined)[0].id === "a", "No target is a no-op");
    }
  );

  await runTest(
    "formatConversationHistory caps turns and characters, keeping the newest",
    "Item 7: Prompt Budget",
    () => {
      const many = Array.from({ length: 30 }, (_, i) => ({ role: "user", content: `msg${i}` }));
      const out = formatConversationHistory(many);
      assert(!out.includes("msg0"), "Oldest turns beyond the cap are dropped");
      assert(out.includes("msg29"), "Newest turn always survives");
      assert(out.split("\n\n").length <= 8, "At most 8 turns retained");

      // A single oversized turn must still be kept, not silently blanked.
      const huge = [{ role: "user", content: "x".repeat(50000) }];
      assert(formatConversationHistory(huge).length > 0, "A lone oversized turn is retained");

      const budget = formatConversationHistory(
        Array.from({ length: 8 }, (_, i) => ({ role: "user", content: "y".repeat(5000) + i }))
      );
      assert(budget.length <= 12000, "Char budget bounds the block");
      assert(formatConversationHistory([]) === "", "Empty history is empty string");
    }
  );

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log("\n================================================================================");
  const total = reports.length;
  const passed = reports.filter((r) => r.passed).length;
  const failed = reports.filter((r) => !r.passed).length;
  console.log(`TOTAL TESTS: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("================================================================================");

  if (failed > 0) {
    console.error("Test failures detected:");
    reports.filter((r) => !r.passed).forEach((r) => console.error(`- ${r.name}: ${r.error}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal runner error:", err);
  process.exit(1);
});
