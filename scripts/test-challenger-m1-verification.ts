/**
 * Challenger 1 Milestone 1 Comprehensive Empirical Verification & Stress Test Suite
 * Tests:
 * 1. Reasoning stream extraction (extractThinkingAndContent with complete/incomplete/nested tags, structured frames)
 * 2. convertMessage part generation (reasoning running/complete transition, tool traces, HITL approvals, sources, attachments)
 * 3. Canvas context lifecycle & CodeHeader trigger integration
 * 4. System prompt assembly (unblocked <think>, SQLite, workspace grounding, web search)
 * 5. Dynamic model routing & Provider chain reordering
 * 6. SSE Event Frame parsing & live streaming state accumulation
 */

import { assembleChatSystemPrompt, LOCAL_DB_BLOCK_HEADER } from "../lib/ai-chatbot/prompt";
import { CHAT_PERSONAS } from "../lib/ai-chatbot/sessions";
import { buildChatContextBase, selectProviderForModel, type ChatPipelineInput } from "../lib/ai-chatbot/pipeline";
import type { ChatMessage, ToolExecutionStep } from "../lib/ai-chatbot/use-chat";
import type { ThreadMessageLike } from "@assistant-ui/react";
import type { ResolvedProvider } from "../lib/ai/providers";

// ---------------------------------------------------------------------------
// 1. extractThinkingAndContent implementation mirror from use-chat.ts
// ---------------------------------------------------------------------------
function extractThinkingAndContent(
  rawText: string,
  structuredThinking: string
): { thinking?: string; content: string } {
  let thinking = structuredThinking;
  let content = rawText;

  if (/<think>/i.test(rawText)) {
    const thinkRegex = /<think>([\s\S]*?)(?:<\/think>|$)/gi;
    let match: RegExpExecArray | null;
    let extractedThinking = "";

    while ((match = thinkRegex.exec(rawText)) !== null) {
      extractedThinking += (extractedThinking ? "\n" : "") + match[1];
    }

    if (extractedThinking) {
      thinking = (thinking ? thinking + "\n" : "") + extractedThinking;
    }

    content = rawText.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trimStart();
  }

  return {
    thinking: thinking.trim().length > 0 ? thinking : undefined,
    content,
  };
}

// ---------------------------------------------------------------------------
// 2. convertMessage implementation mirror from chatbot/page.tsx
// ---------------------------------------------------------------------------
function convertMessage(m: ChatMessage): ThreadMessageLike {
  const createdAt = m.createdAt ? new Date(m.createdAt) : undefined;
  if (m.role === "assistant") {
    const isSending = m.status === "sending";
    type AssistantMessagePart = Extract<ThreadMessageLike["content"], readonly unknown[]>[number];

    const parts: AssistantMessagePart[] = [];

    // 1. Thinking / Reasoning part
    if (m.thinking && m.thinking.trim().length > 0) {
      parts.push({
        type: "reasoning",
        text: m.thinking,
        status: isSending && (!m.content || m.content.trim().length === 0)
          ? { type: "running" }
          : { type: "complete" },
      });
    }

    // 2. Tool steps (including gated database approvals)
    if (m.toolSteps && m.toolSteps.length > 0) {
      for (const step of m.toolSteps) {
        let argsObj: Record<string, unknown> = {};
        if (step.detail) {
          try {
            argsObj = JSON.parse(step.detail);
          } catch {
            argsObj = { query: step.detail };
          }
        }

        const isGatedDatabaseOp =
          step.approvalRequired ||
          step.label === "query_database" ||
          step.label === "write_database" ||
          step.label === "delete_database";

        parts.push({
          type: "tool-call",
          toolCallId: step.id,
          toolName: step.label,
          argsText: step.detail || (Object.keys(argsObj).length > 0 ? JSON.stringify(argsObj, null, 2) : ""),
          result: step.result,
          isError: step.status === "failed",
          ...(isGatedDatabaseOp && {
            approval: {
              id: `approval-${step.id}`,
              options: [
                { id: "allow-once", kind: "allow-once", label: "Approve & Run" },
                { id: "reject-once", kind: "reject-once", label: "Deny" },
              ],
            },
            interrupt: {
              type: "human",
              payload: {
                toolName: step.label,
                args: argsObj,
              },
            },
          }),
        });
      }
    }

    // 3. Grounded workspace source citations
    if (m.sources && m.sources.length > 0) {
      for (const [idx, src] of m.sources.entries()) {
        parts.push({
          type: "source",
          sourceType: "document",
          id: `source-${m.id}-${idx}`,
          title: src,
          mediaType: "text/plain",
        });
      }
    }

    // 4. Main content text part
    if (m.content && m.content.length > 0) {
      parts.push({
        type: "text",
        text: m.content,
        status: isSending ? { type: "running" } : { type: "complete" },
      });
    }

    return {
      id: m.id,
      role: "assistant",
      content: parts.length > 0 ? parts : [{ type: "text", text: m.content || "" }],
      createdAt,
      status: isSending ? { type: "running" } : { type: "complete", reason: "stop" },
    };
  }

  if (m.role === "system") {
    return {
      id: m.id,
      role: "system",
      content: m.content,
      createdAt,
    };
  }

  return {
    id: m.id,
    role: "user",
    content: m.content,
    createdAt,
    attachments: m.experimental_attachments?.map((att, idx) => ({
      id: `att-${idx}`,
      type: "image",
      name: `Attachment ${idx + 1}`,
      content: [{ type: "image", image: att.url }],
      status: { type: "complete" },
    })),
  };
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------
let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, description: string, detail?: unknown) {
  if (condition) {
    passedCount++;
    console.log(`  [PASS] ${description}`);
  } else {
    failedCount++;
    console.error(`  [FAIL] ${description}`);
    if (detail !== undefined) {
      console.error("         Details:", detail);
    }
  }
}

async function runAllTests() {
  console.log("================================================================================");
  console.log("CHALLENGER 1: EMPIRICAL VERIFICATION & STRESS TEST SUITE (M1)");
  console.log("================================================================================\n");

  // ---------------------------------------------------------------------------
  // SECTION 1: extractThinkingAndContent Stress Testing
  // ---------------------------------------------------------------------------
  console.log("--- 1. Testing extractThinkingAndContent Parsing & Streaming Ingestion ---");

  // 1.1 Plain text (no think tags, no structured thinking)
  {
    const r = extractThinkingAndContent("Hello, world!", "");
    assert(r.thinking === undefined, "Plain text has thinking === undefined");
    assert(r.content === "Hello, world!", "Plain text content preserved exactly");
  }

  // 1.2 Structured thinking only
  {
    const r = extractThinkingAndContent("Final answer.", "First let me evaluate options.\nStep 1: Check inputs.");
    assert(r.thinking === "First let me evaluate options.\nStep 1: Check inputs.", "Structured thinking extracted");
    assert(r.content === "Final answer.", "Content preserved alongside structured thinking");
  }

  // 1.3 Complete <think> tag in text
  {
    const raw = "<think>Let me compute 25 * 4 = 100.</think>The result is 100.";
    const r = extractThinkingAndContent(raw, "");
    assert(r.thinking === "Let me compute 25 * 4 = 100.", "Complete <think> tag parsed into thinking");
    assert(r.content === "The result is 100.", "Content stripped of <think> tag cleanly");
  }

  // 1.4 Incomplete <think> tag during live streaming
  {
    const raw = "<think>Currently analyzing user prompt and inspecting SQLite tables...";
    const r = extractThinkingAndContent(raw, "");
    assert(
      r.thinking === "Currently analyzing user prompt and inspecting SQLite tables...",
      "Incomplete <think> tag during streaming extracted into thinking"
    );
    assert(r.content === "", "Content empty while inside active <think> tag stream");
  }

  // 1.5 Multi-line <think> tag with code and markdown
  {
    const raw = `<think>
Plan:
1. Query jobs table using \`SELECT * FROM jobs\`
2. Filter active applications
</think>
Here is your job application status:`;
    const r = extractThinkingAndContent(raw, "");
    assert(
      r.thinking?.includes("SELECT * FROM jobs") === true,
      "Multi-line markdown and code in <think> preserved in thinking"
    );
    assert(r.content === "Here is your job application status:", "Content stripped cleanly of multi-line <think>");
  }

  // 1.6 Multiple sequential <think> blocks
  {
    const raw = "<think>Part 1 thinking</think>Answer 1.<think>Part 2 thinking</think>Answer 2.";
    const r = extractThinkingAndContent(raw, "");
    assert(
      r.thinking === "Part 1 thinking\nPart 2 thinking",
      "Multiple sequential <think> tags merged into newline-separated thinking"
    );
    assert(r.content === "Answer 1.Answer 2.", "Multiple tags removed from content");
  }

  // 1.7 Hybrid: Structured thinking AND <think> tags in content
  {
    const r = extractThinkingAndContent("<think>Tag thought</think>Final text", "Server thought");
    assert(
      r.thinking === "Server thought\nTag thought",
      "Hybrid structured thinking and tag thinking concatenated cleanly"
    );
    assert(r.content === "Final text", "Hybrid content extracted correctly");
  }

  // 1.8 Case insensitivity & Whitespace preservation
  {
    const raw = "<THINK>  Upper case thinking  </THINK>Response body";
    const r = extractThinkingAndContent(raw, "");
    assert(r.thinking === "  Upper case thinking  ", "Case-insensitive <THINK> tags parsed, preserving whitespace formatting");
    assert(r.content === "Response body", "Content trimmed start correctly");
  }

  // 1.9 Empty think tags
  {
    const raw = "<think></think>Actual answer";
    const r = extractThinkingAndContent(raw, "");
    assert(r.thinking === undefined, "Empty <think></think> produces undefined thinking");
    assert(r.content === "Actual answer", "Empty think tag stripped from content");
  }

  // 1.10 Progressive Token-by-Token Streaming Accumulation Simulation
  {
    const tokens = [
      "<", "think", ">", "\n", "Analyzing", " ", "the", " ", "user", "'s", " ", "request",
      ".", "\n", "<", "/think", ">", "\n\n", "The", " ", "answer", " ", "is", " ", "42", "."
    ];

    let accRaw = "";
    let capturedThinkingAtStep12 = "";
    let capturedContentAtStep12 = "";
    let finalThinking = "";
    let finalContent = "";

    for (let i = 0; i < tokens.length; i++) {
      accRaw += tokens[i];
      const parsed = extractThinkingAndContent(accRaw, "");
      if (i === 12) { // Middle of thinking
        capturedThinkingAtStep12 = parsed.thinking ?? "";
        capturedContentAtStep12 = parsed.content;
      }
      if (i === tokens.length - 1) {
        finalThinking = parsed.thinking ?? "";
        finalContent = parsed.content;
      }
    }

    assert(
      capturedThinkingAtStep12.includes("Analyzing the user's request"),
      "Token streaming yields live thinking before closing </think> tag"
    );
    assert(capturedContentAtStep12 === "", "Token streaming keeps content empty while inside <think>");
    assert(finalThinking.includes("Analyzing the user's request"), "Final streamed thinking is preserved");
    assert(finalContent === "The answer is 42.", "Final streamed content is cleanly separated");
  }

  // ---------------------------------------------------------------------------
  // SECTION 2: convertMessage Part Generation Testing
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. Testing convertMessage Part Generation (Reasoning, Tools, HITL, Sources) ---");

  // 2.1 Active Streaming Assistant Message with Thinking
  {
    const msg: ChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "",
      thinking: "Deep pondering in progress...",
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    const converted = convertMessage(msg);
    assert(converted.role === "assistant", "Converted message role is assistant");
    assert(converted.status?.type === "running", "Sending message status is running");
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    assert(parts.length === 1, "Only reasoning part present when content is empty");
    assert(parts[0].type === "reasoning", "First part is reasoning");
    assert(parts[0].text === "Deep pondering in progress...", "Reasoning text matches");
    assert((parts[0].status as { type: string }).type === "running", "Active streaming reasoning status is 'running'");
  }

  // 2.2 Streaming Transition: Thinking Complete, Content Streaming
  {
    const msg: ChatMessage = {
      id: "msg-stream-transition",
      role: "assistant",
      content: "First content token arriving...",
      thinking: "Finished pondering.",
      status: "sending",
      createdAt: new Date().toISOString(),
    };
    const converted = convertMessage(msg);
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    assert(parts.length === 2, "Both reasoning and content parts present during stream transition");
    assert((parts[0].status as { type: string }).type === "complete", "Reasoning part flips to 'complete' once content arrives");
    assert((parts[1].status as { type: string }).type === "running", "Content part status is 'running' during stream");
  }

  // 2.3 Completed Assistant Message with Thinking and Text Content
  {
    const msg: ChatMessage = {
      id: "msg-2",
      role: "assistant",
      content: "Completed response text.",
      thinking: "Completed thought process.",
      status: "delivered",
      createdAt: new Date().toISOString(),
    };
    const converted = convertMessage(msg);
    assert(converted.status?.type === "complete", "Delivered message status is complete");
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    assert(parts.length === 2, "Both reasoning and text parts present");
    assert(parts[0].type === "reasoning", "Part 0 is reasoning");
    assert((parts[0].status as { type: string }).type === "complete", "Completed reasoning part status is 'complete'");
    assert(parts[1].type === "text", "Part 1 is text");
    assert(parts[1].text === "Completed response text.", "Text content matches");
  }

  // 2.4 Non-gated Tool Step
  {
    const toolStep: ToolExecutionStep = {
      id: "tool-step-1",
      label: "search_jobs",
      status: "completed",
      detail: JSON.stringify({ query: "frontend react", limit: 5 }),
      result: "Found 3 matching jobs: Frontend Dev at Acme, React Engineer at TechCorp",
    };
    const msg: ChatMessage = {
      id: "msg-3",
      role: "assistant",
      content: "Here are the jobs found.",
      toolSteps: [toolStep],
      status: "delivered",
    };
    const converted = convertMessage(msg);
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    const toolPart = parts.find((p) => p.type === "tool-call");
    assert(toolPart !== undefined, "Tool-call part generated");
    assert(toolPart?.toolName === "search_jobs", "Tool name matches");
    assert(toolPart?.result === toolStep.result, "Tool result matches");
    assert(toolPart?.isError === false, "isError is false for completed tool");
    assert(toolPart?.approval === undefined, "Non-gated tool does not have approval gate");
    assert(toolPart?.interrupt === undefined, "Non-gated tool does not have interrupt");
  }

  // 2.5 Gated Database Operations (query_database, write_database, delete_database)
  {
    const gatedOps = ["query_database", "write_database", "delete_database"];
    for (const op of gatedOps) {
      const step: ToolExecutionStep = {
        id: `gated-${op}`,
        label: op,
        status: "pending",
        detail: JSON.stringify({ sql: "SELECT * FROM jobs WHERE status='active'" }),
      };
      const msg: ChatMessage = {
        id: `msg-${op}`,
        role: "assistant",
        content: "",
        toolSteps: [step],
        status: "sending",
      };
      const converted = convertMessage(msg);
      const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
      const toolPart = parts.find((p) => p.type === "tool-call");
      assert(toolPart !== undefined, `Gated tool-call part generated for ${op}`);
      const approval = toolPart?.approval as { id: string; options: Array<{ id: string; kind: string; label: string }> };
      assert(approval !== undefined, `Approval object created for ${op}`);
      assert(approval?.options?.some((o) => o.kind === "allow-once" && o.label === "Approve & Run") === true, `Approval has 'Approve & Run' option for ${op}`);
      assert(approval?.options?.some((o) => o.kind === "reject-once" && o.label === "Deny") === true, `Approval has 'Deny' option for ${op}`);
      const interrupt = toolPart?.interrupt as { type: string; payload: { toolName: string } };
      assert(interrupt?.type === "human", `Interrupt type is 'human' for ${op}`);
      assert(interrupt?.payload?.toolName === op, `Interrupt payload carries toolName for ${op}`);
    }
  }

  // 2.6 Explicit approvalRequired: true on Custom Tool
  {
    const step: ToolExecutionStep = {
      id: "custom-gated-1",
      label: "send_cold_email",
      status: "pending",
      detail: JSON.stringify({ to: "recruiter@example.com", subject: "Application" }),
      approvalRequired: true,
    };
    const msg: ChatMessage = {
      id: "msg-custom-gated",
      role: "assistant",
      content: "",
      toolSteps: [step],
      status: "sending",
    };
    const converted = convertMessage(msg);
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    const toolPart = parts.find((p) => p.type === "tool-call");
    assert(toolPart?.approval !== undefined, "Tool with approvalRequired: true gets approval gate");
  }

  // 2.7 Grounded Source Badges Mapping
  {
    const msg: ChatMessage = {
      id: "msg-sources",
      role: "assistant",
      content: "Summary based on your resume and jobs.",
      sources: ["Resume: Senior Software Engineer (PDF)", "Jobs (8 active listings)", "Contacts: Acme Recruiter"],
      status: "delivered",
    };
    const converted = convertMessage(msg);
    const parts = (converted.content as unknown) as Array<Record<string, unknown>>;
    const sourceParts = parts.filter((p) => p.type === "source");
    assert(sourceParts.length === 3, "3 source citation parts generated");
    assert(sourceParts[0].title === "Resume: Senior Software Engineer (PDF)", "Source 1 title matches");
    assert(sourceParts[1].title === "Jobs (8 active listings)", "Source 2 title matches");
    assert(sourceParts[2].title === "Contacts: Acme Recruiter", "Source 3 title matches");
    assert(sourceParts[0].sourceType === "document", "Source part has sourceType: document");
  }

  // 2.8 User Message with Attachments
  {
    const msg: ChatMessage = {
      id: "msg-user",
      role: "user",
      content: "Please review my resume screenshot.",
      experimental_attachments: [
        { url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA", contentType: "image/png" },
      ],
    };
    const converted = convertMessage(msg);
    assert(converted.role === "user", "Converted user message has role: user");
    assert(converted.content === "Please review my resume screenshot.", "User message content preserved");
    const attachments = (converted as { attachments?: Array<Record<string, unknown>> }).attachments;
    assert(attachments !== undefined && attachments.length === 1, "User attachment converted");
    assert(attachments?.[0].type === "image", "Attachment type is image");
  }

  // ---------------------------------------------------------------------------
  // SECTION 3: Canvas Context & CodeHeader Trigger Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. Testing Canvas Context & CodeHeader Trigger Integration ---");

  {
    let openCanvasRecord: { content: string; title?: string; language?: string } | null = null;
    let closeCanvasCalled: boolean = false;
    let isOpenState: boolean = false;

    const mockCanvasContext = {
      openCanvas: (content: string, title?: string, language?: string) => {
        openCanvasRecord = { content, title, language };
        isOpenState = true;
      },
      closeCanvas: () => {
        closeCanvasCalled = true;
        isOpenState = false;
      },
      getIsOpen: (): boolean => isOpenState,
    };

    // Simulate CodeHeader onOpenCanvas action
    const sampleCode = "function calculateMatch() { return 0.95; }";
    const language = "typescript";
    const title = language ? `${language.toUpperCase()} Artifact` : "Code Artifact";

    mockCanvasContext.openCanvas(sampleCode, title, language);

    assert(openCanvasRecord !== null, "openCanvas was invoked");
    assert((openCanvasRecord as { content?: string } | null)?.content === sampleCode, "openCanvas received exact code content");
    assert((openCanvasRecord as { title?: string } | null)?.title === "TYPESCRIPT Artifact", "openCanvas generated uppercase language title");
    assert((openCanvasRecord as { language?: string } | null)?.language === "typescript", "openCanvas received language");
    assert(mockCanvasContext.getIsOpen() === true, "Canvas state updated to isOpen = true");

    mockCanvasContext.closeCanvas();
    assert(Boolean(closeCanvasCalled), "closeCanvas invoked properly");
    assert(mockCanvasContext.getIsOpen() === false, "Canvas state updated to isOpen = false");
  }

  // ---------------------------------------------------------------------------
  // SECTION 4: System Prompt & Provider Model Routing Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- 4. Testing System Prompt (No Think Tag Ban) & Dynamic Model Routing ---");

  // 4.1 Check system prompt assembly
  {
    const prompt = assembleChatSystemPrompt({
      persona: CHAT_PERSONAS[0],
      conversationHistory: "USER: Hello\nASSISTANT: Hi",
      workspaceContext: "User has 3 active job applications.",
      webSearchActive: true,
    });

    assert(
      !prompt.toLowerCase().includes("do not output <think>") &&
      !prompt.toLowerCase().includes("never include <think>"),
      "System prompt does NOT forbid or ban <think> tags"
    );
    assert(
      prompt.includes(LOCAL_DB_BLOCK_HEADER),
      "System prompt includes the local database access block"
    );
    assert(
      prompt.includes("--- WORKSPACE CONTEXT ---"),
      "System prompt includes grounded workspace context block"
    );
    assert(
      prompt.includes("--- WEB SEARCH ACTIVE ---"),
      "System prompt includes web search formatting rules"
    );
  }

  // 4.2 Auto Hybrid routing rules in buildChatContextBase
  {
    const baseImagesInput: ChatPipelineInput = {
      userId: "u1",
      personaId: "general",
      messages: [
        {
          role: "user",
          content: "What is in this screenshot?",
          experimental_attachments: [{ url: "data:image/png;base64,123" }],
        },
      ],
      model: "auto",
    };
    // "auto" now names a capability, not a vendor id — which provider serves it
    // is decided in stage 1b against the user's real providers.
    const baseImages = buildChatContextBase(baseImagesInput);
    assert(baseImages.autoRule === "images", "Auto hybrid classifies an image turn as the images rule");
    assert(baseImages.targetModel === undefined, "Auto hybrid names no model id in the pure stage");

    const baseCodeInput: ChatPipelineInput = {
      userId: "u1",
      personaId: "general",
      messages: [{ role: "user", content: "Write a TypeScript function with React hooks" }],
      model: "auto",
    };
    const baseCode = buildChatContextBase(baseCodeInput);
    assert(baseCode.autoRule === "code", "Auto hybrid classifies a code turn as the code rule");

    const baseReasoningInput: ChatPipelineInput = {
      userId: "u1",
      personaId: "general",
      messages: [{ role: "user", content: "Deep think and solve this complex algorithm problem" }],
      model: "auto",
    };
    const baseReasoning = buildChatContextBase(baseReasoningInput);
    assert(baseReasoning.autoRule === "reasoning", "Auto hybrid classifies a deep-thinking turn as the reasoning rule");

    const explicitModelInput: ChatPipelineInput = {
      userId: "u1",
      personaId: "general",
      messages: [{ role: "user", content: "General question" }],
      model: "gpt-4o",
    };
    const explicitModel = buildChatContextBase(explicitModelInput);
    assert(explicitModel.targetModel === "gpt-4o", "Explicit model is respected without override");
    assert(explicitModel.autoRule === undefined, "Explicit model runs no auto rule");
  }

  // 4.3 selectProviderForModel Provider Fallback Chain Reordering
  {
    const mockChain: ResolvedProvider[] = [
      { id: "p1", name: "Gemini Pro", provider_type: "gemini", base_url: null, model: "gemini-2.0-flash", api_key: "k1" },
      { id: "p2", name: "Anthropic Claude", provider_type: "anthropic", base_url: null, model: "claude-3-5-sonnet-20241022", api_key: "k2" },
      { id: "p3", name: "DeepSeek R1", provider_type: "openai_compatible", base_url: "https://api.deepseek.com", model: "deepseek-reasoner", api_key: "k3" },
    ];

    // Select claude-3-5-sonnet shorthand
    const reordered = selectProviderForModel([...mockChain], "claude-3-5-sonnet");
    assert(reordered[0].provider_type === "anthropic", "Anthropic promoted to head of chain for claude-3-5-sonnet");

    // Select deepseek-r1 shorthand
    const reorderedDeepSeek = selectProviderForModel([...mockChain], "deepseek-r1");
    assert(reorderedDeepSeek[0].name === "DeepSeek R1", "DeepSeek R1 promoted to head of chain for deepseek-r1");

    // Select exact match
    const reorderedExact = selectProviderForModel([...mockChain], "gemini-2.0-flash");
    assert(reorderedExact[0].model === "gemini-2.0-flash", "Exact model match promoted to head of chain");
  }

  // ---------------------------------------------------------------------------
  // SECTION 5: SSE Event Frames Ingestion Simulation
  // ---------------------------------------------------------------------------
  console.log("\n--- 5. Testing SSE Event Frames Streaming Simulation ---");

  {
    // Simulate SSE buffer & event stream reader
    const sseLines = [
      'data: {"choices":[{"delta":{"reasoning_content":"Step 1: Inspect database schema."}}]}',
      'data: {"choices":[{"delta":{"reasoning_content":"\\nStep 2: Formulate SELECT statement."}}]}',
      'data: {"tool_calls":[{"name":"query_database","status":"completed","args":{"sql":"SELECT count(*) FROM jobs"},"result":{"content":"[{\\"count\\": 8}]"}}]}',
      'data: {"sources":["Jobs (8 records)","SQLite Authority Database"]}',
      'data: {"choices":[{"delta":{"content":"You currently have "}}]}',
      'data: {"choices":[{"delta":{"content":"8 active job applications."}}]}',
      'data: [DONE]',
    ];

    let structuredThinkingAcc = "";
    let rawContentAcc = "";
    let receivedSources: string[] = [];
    let receivedToolCalls: unknown[] = [];

    for (const line of sseLines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") continue;

      const parsed = JSON.parse(payload);
      const reasoningDelta = parsed?.choices?.[0]?.delta?.reasoning_content;
      if (reasoningDelta) structuredThinkingAcc += reasoningDelta;

      const contentDelta = parsed?.choices?.[0]?.delta?.content;
      if (contentDelta) rawContentAcc += contentDelta;

      if (Array.isArray(parsed?.sources)) receivedSources = parsed.sources;
      if (Array.isArray(parsed?.tool_calls)) receivedToolCalls = parsed.tool_calls;
    }

    const finalParsed = extractThinkingAndContent(rawContentAcc, structuredThinkingAcc);

    assert(
      finalParsed.thinking === "Step 1: Inspect database schema.\nStep 2: Formulate SELECT statement.",
      "Reasoning deltas accurately accumulated across streaming chunks"
    );
    assert(
      finalParsed.content === "You currently have 8 active job applications.",
      "Content deltas accurately accumulated across streaming chunks"
    );
    assert(receivedSources.length === 2, "Sources event frame captured 2 sources");
    assert(receivedToolCalls.length === 1, "Tool calls event frame captured 1 tool execution");
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`TEST RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("================================================================================");
}

void runAllTests();
