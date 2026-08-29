import {
  isProviderAvailable,
  recordProviderSuccess,
  recordProviderFailure,
  resetProviderCircuit,
  resetAllCircuits,
  getCircuitBreakerStatus,
  getProviderCooldownRemaining,
  resolveHopTimeout,
  resolveToolRoundTimeout,
  DEFAULT_FAILURE_THRESHOLD,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_HOP_TIMEOUT_MS,
  DEFAULT_LOCAL_HOP_TIMEOUT_MS,
  DEFAULT_CLOUD_HOP_TIMEOUT_MS,
  DEFAULT_TOOL_ROUND_TIMEOUT_MS,
} from "@/lib/ai/circuit-breaker";
import { runChain, type ResolvedProvider, type GenerateTextInput, type GenerateTextResult } from "@/lib/ai/providers";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✓ ${msg}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${msg}`);
    failed++;
  }
}

async function main() {
  console.log("\n=======================================================");
  console.log("  VERIFICATION: AI Circuit Breaker Module & Integration");
  console.log("=======================================================\n");

  resetAllCircuits();

  // Test 1: Initial state
  console.log("[Test 1] Initial circuit state");
  assert(isProviderAvailable("prov-1"), "Provider starts available");
  const initialStatus = getCircuitBreakerStatus("prov-1");
  assert(initialStatus.state === "CLOSED", "State is CLOSED");
  assert(initialStatus.consecutiveFailures === 0, "Consecutive failures is 0");

  // Test 2: Consecutive failures trip to OPEN
  console.log("\n[Test 2] Tripping circuit after consecutive failures");
  recordProviderFailure("prov-1", new Error("Rate limit 429"));
  assert(isProviderAvailable("prov-1"), "Failure 1: still available");
  recordProviderFailure("prov-1", new Error("Rate limit 429"));
  assert(isProviderAvailable("prov-1"), "Failure 2: still available");
  recordProviderFailure("prov-1", new Error("Rate limit 429"));
  assert(!isProviderAvailable("prov-1"), "Failure 3: circuit OPEN (fast fail)");

  const openStatus = getCircuitBreakerStatus("prov-1");
  assert(openStatus.state === "OPEN", "Status state is OPEN");
  assert(openStatus.consecutiveFailures === 3, "consecutiveFailures is 3");
  assert(getProviderCooldownRemaining("prov-1") > 0, "Cooldown remaining is > 0");

  // Test 3: Provider isolation
  console.log("\n[Test 3] Provider isolation");
  assert(isProviderAvailable("prov-2"), "Independent provider prov-2 is still available");

  // Test 4: Reset provider circuit
  console.log("\n[Test 4] Manual reset");
  resetProviderCircuit("prov-1");
  assert(isProviderAvailable("prov-1"), "After reset, prov-1 is available");
  assert(getCircuitBreakerStatus("prov-1").state === "CLOSED", "State is CLOSED after reset");

  // Test 5: Timeout resolution
  console.log("\n[Test 5] Timeout resolution");
  assert(resolveHopTimeout() === DEFAULT_HOP_TIMEOUT_MS, `Default hop timeout is ${DEFAULT_HOP_TIMEOUT_MS}`);
  
  const localProvider: ResolvedProvider = {
    id: "ollama-local",
    name: "Ollama",
    provider_type: "openai_compatible",
    base_url: "http://127.0.0.1:11434/v1",
    model: "llama3.2",
    api_key: "dummy",
  };
  assert(resolveHopTimeout(localProvider) === DEFAULT_LOCAL_HOP_TIMEOUT_MS, `Local model timeout is ${DEFAULT_LOCAL_HOP_TIMEOUT_MS}`);

  const cloudProvider: ResolvedProvider = {
    id: "anthropic-cloud",
    name: "Claude",
    provider_type: "anthropic",
    base_url: null,
    model: "claude-3-5-sonnet",
    api_key: "dummy",
  };
  assert(resolveHopTimeout(cloudProvider) === DEFAULT_CLOUD_HOP_TIMEOUT_MS, `Cloud model timeout is ${DEFAULT_CLOUD_HOP_TIMEOUT_MS}`);

  process.env.AI_HOP_TIMEOUT_MS = "45000";
  assert(resolveHopTimeout(cloudProvider) === 45000, "Env override AI_HOP_TIMEOUT_MS honored");
  delete process.env.AI_HOP_TIMEOUT_MS;

  assert(resolveToolRoundTimeout() === DEFAULT_TOOL_ROUND_TIMEOUT_MS, `Tool round timeout is ${DEFAULT_TOOL_ROUND_TIMEOUT_MS}`);
  process.env.AI_TOOL_ROUND_TIMEOUT_MS = "18000";
  assert(resolveToolRoundTimeout() === 18000, "Env override AI_TOOL_ROUND_TIMEOUT_MS honored");
  delete process.env.AI_TOOL_ROUND_TIMEOUT_MS;

  // Test 6: runChain fast-fail bypass of OPEN providers
  console.log("\n[Test 6] runChain fast-fail bypass of OPEN provider");
  resetAllCircuits();

  const mockProvider1: ResolvedProvider = {
    id: "mock-failing",
    name: "Failing Provider",
    provider_type: "gemini",
    base_url: null,
    model: "gemini-2.0-flash",
    api_key: "dummy",
  };

  const mockProvider2: ResolvedProvider = {
    id: "mock-healthy",
    name: "Healthy Provider",
    provider_type: "anthropic",
    base_url: null,
    model: "claude-3-5-sonnet",
    api_key: "dummy",
  };

  // Trip mockProvider1 to OPEN
  recordProviderFailure("mock-failing", new Error("429 Quota"));
  recordProviderFailure("mock-failing", new Error("429 Quota"));
  recordProviderFailure("mock-failing", new Error("429 Quota"));
  assert(!isProviderAvailable("mock-failing"), "mock-failing is OPEN");

  let mock1Called = false;
  let mock2Called = false;

  const mockCaller = (type: string) => {
    return async (p: ResolvedProvider, input: GenerateTextInput): Promise<GenerateTextResult> => {
      if (p.id === "mock-failing") {
        mock1Called = true;
        throw new Error("Should not be called when OPEN!");
      }
      if (p.id === "mock-healthy") {
        mock2Called = true;
        return {
          text: "Hello from healthy provider",
          providerName: p.name,
          model: p.model,
          inputTokens: 10,
          outputTokens: 20,
        };
      }
      throw new Error("Unknown provider");
    };
  };

  const chainResult = await runChain(
    [mockProvider1, mockProvider2],
    { userPrompt: "Test prompt" },
    { action: "test_chain" },
    mockCaller as any
  );

  assert(!mock1Called, "OPEN provider mock-failing was skipped immediately without calling network caller");
  assert(mock2Called, "Healthy fallback provider mock-healthy was called and served result");
  assert(chainResult.text === "Hello from healthy provider", "Result from healthy fallback returned");

  console.log("\n-------------------------------------------------------");
  console.log(`Integration Suite Completed: ${passed} passed, ${failed} failed`);
  console.log("-------------------------------------------------------\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error in verification:", err);
  process.exit(1);
});
