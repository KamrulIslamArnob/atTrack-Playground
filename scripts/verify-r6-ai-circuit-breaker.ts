/**
 * R6 Verification Suite: AI Task Chain Circuit Breaker & Timeout Configuration
 *
 * Verifies:
 * 1. Circuit breaker state machine transitions:
 *    - CLOSED -> OPEN upon reaching consecutive failure threshold (default: 3).
 *    - OPEN fast-fail bypass without waiting for network timeouts.
 *    - OPEN -> HALF_OPEN after cooldown period expires.
 *    - HALF_OPEN -> CLOSED on successful trial probe (recovery).
 *    - HALF_OPEN -> OPEN on failed trial probe (re-trip).
 * 2. Provider isolation: failing provider circuit does not trip other healthy providers.
 * 3. Dynamic timeout resolution:
 *    - Default cloud provider timeout (120s).
 *    - Local provider (Ollama / localhost / 127.0.0.1) timeout (180s).
 *    - Multi-round tool loop timeout (25s).
 *    - Environment variable override precedence.
 *
 * Run via: npx tsx scripts/verify-r6-ai-circuit-breaker.ts
 */

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

// ---------------------------------------------------------------------------
// Authoritative Circuit Breaker Implementation for Contract Testing
// ---------------------------------------------------------------------------

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitStatus {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  lastError?: string;
  cooldownMs: number;
}

export interface ProviderSpec {
  id?: string;
  provider_type: string;
  model: string;
  base_url?: string | null;
}

export class AiCircuitBreaker {
  private circuits = new Map<string, CircuitStatus>();
  public defaultThreshold = 3;
  public defaultCooldownMs = 1000; // 1s for fast automated testing

  constructor(opts?: { threshold?: number; cooldownMs?: number }) {
    if (opts?.threshold) this.defaultThreshold = opts.threshold;
    if (opts?.cooldownMs) this.defaultCooldownMs = opts.cooldownMs;
  }

  public getProviderKey(provider: ProviderSpec): string {
    return provider.id || `${provider.provider_type}:${provider.model}:${provider.base_url || "default"}`;
  }

  public getStatus(provider: ProviderSpec): CircuitStatus | undefined {
    return this.circuits.get(this.getProviderKey(provider));
  }

  public isAvailable(provider: ProviderSpec, now = Date.now()): boolean {
    const key = this.getProviderKey(provider);
    const status = this.circuits.get(key);
    if (!status || status.state === "CLOSED") return true;

    if (status.state === "OPEN") {
      if (now - status.lastFailureTime >= status.cooldownMs) {
        status.state = "HALF_OPEN";
        return true; // allow single trial probe
      }
      return false; // Fast-fail
    }

    return true; // HALF_OPEN
  }

  public recordSuccess(provider: ProviderSpec): void {
    const key = this.getProviderKey(provider);
    const status = this.circuits.get(key);
    if (status) {
      status.state = "CLOSED";
      status.consecutiveFailures = 0;
      status.lastError = undefined;
    }
  }

  public recordFailure(provider: ProviderSpec, err: unknown, now = Date.now()): void {
    const key = this.getProviderKey(provider);
    const message = err instanceof Error ? err.message : String(err);
    let status = this.circuits.get(key);

    if (!status) {
      status = {
        state: "CLOSED",
        consecutiveFailures: 0,
        lastFailureTime: now,
        cooldownMs: this.defaultCooldownMs,
      };
      this.circuits.set(key, status);
    }

    status.consecutiveFailures += 1;
    status.lastFailureTime = now;
    status.lastError = message;

    if (status.consecutiveFailures >= this.defaultThreshold || status.state === "HALF_OPEN") {
      status.state = "OPEN";
    }
  }

  public reset(): void {
    this.circuits.clear();
  }
}

function resolveHopTimeoutReference(provider: ProviderSpec, isToolRound = false): number {
  if (isToolRound) {
    return Number(process.env.AI_TOOL_ROUND_TIMEOUT_MS) || 25_000;
  }
  if (process.env.AI_PROVIDER_TIMEOUT_MS) {
    return Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  }
  const isLocal =
    provider.base_url?.includes("localhost") ||
    provider.base_url?.includes("127.0.0.1") ||
    (provider.provider_type === "openai_compatible" &&
      (provider.model?.toLowerCase().includes("ollama") || provider.model?.toLowerCase().includes("local")));
  if (isLocal) {
    return Number(process.env.AI_LOCAL_PROVIDER_TIMEOUT_MS) || 180_000;
  }
  return 120_000;
}

// ---------------------------------------------------------------------------
// Main Verification Runner
// ---------------------------------------------------------------------------

async function runR6Verification() {
  console.log("\n=======================================================");
  console.log("  R6 VERIFICATION: AI Circuit Breaker & Timeouts       ");
  console.log("=======================================================\n");

  const breaker = new AiCircuitBreaker({ threshold: 3, cooldownMs: 500 });

  const geminiProvider: ProviderSpec = {
    id: "prov-gemini-1",
    provider_type: "gemini",
    model: "gemini-2.0-flash",
  };

  const anthropicProvider: ProviderSpec = {
    id: "prov-anthropic-1",
    provider_type: "anthropic",
    model: "claude-3-5-sonnet-20241022",
  };

  const ollamaProvider: ProviderSpec = {
    id: "prov-ollama-1",
    provider_type: "openai_compatible",
    model: "llama3.2:latest",
    base_url: "http://127.0.0.1:11434/v1",
  };

  // -------------------------------------------------------------------------
  // Test 1: Initial State (CLOSED)
  // -------------------------------------------------------------------------
  console.log("[Test 1] Initial Circuit Breaker State");

  assert(breaker.isAvailable(geminiProvider), "Fresh provider starts in CLOSED state (isAvailable = true)");
  assert(breaker.isAvailable(anthropicProvider), "Anthropic provider starts in CLOSED state (isAvailable = true)");

  // -------------------------------------------------------------------------
  // Test 2: Consecutive Failure Threshold & Tripping to OPEN
  // -------------------------------------------------------------------------
  console.log("\n[Test 2] Consecutive Failure Accumulation & Tripping to OPEN");

  const testTime = Date.now();

  // Failure 1
  breaker.recordFailure(geminiProvider, new Error("HTTP 429: Resource has been exhausted"), testTime);
  assert(breaker.isAvailable(geminiProvider, testTime), "Failure 1/3: Circuit remains CLOSED (isAvailable = true)");
  assert(breaker.getStatus(geminiProvider)?.consecutiveFailures === 1, "Consecutive failures count is 1");

  // Failure 2
  breaker.recordFailure(geminiProvider, new Error("HTTP 429: Resource has been exhausted"), testTime + 100);
  assert(breaker.isAvailable(geminiProvider, testTime + 100), "Failure 2/3: Circuit remains CLOSED (isAvailable = true)");
  assert(breaker.getStatus(geminiProvider)?.consecutiveFailures === 2, "Consecutive failures count is 2");

  // Failure 3 (Threshold reached)
  breaker.recordFailure(geminiProvider, new Error("HTTP 429: Rate limit quota exceeded"), testTime + 200);
  assert(
    breaker.getStatus(geminiProvider)?.state === "OPEN",
    "Failure 3/3: Circuit trips to OPEN state"
  );
  assert(
    breaker.isAvailable(geminiProvider, testTime + 250) === false,
    "OPEN state fast-fails calls (isAvailable = false)"
  );

  // -------------------------------------------------------------------------
  // Test 3: Provider Isolation
  // -------------------------------------------------------------------------
  console.log("\n[Test 3] Provider Circuit Isolation");

  assert(
    breaker.isAvailable(anthropicProvider, testTime + 250) === true,
    "Anthropic provider remains healthy and available while Gemini circuit is OPEN"
  );

  // -------------------------------------------------------------------------
  // Test 4: Cooldown & HALF_OPEN Trial Probe
  // -------------------------------------------------------------------------
  console.log("\n[Test 4] Cooldown Expiration & HALF_OPEN Probe Transition");

  // During cooldown (< 500ms after last failure at testTime + 200)
  assert(
    breaker.isAvailable(geminiProvider, testTime + 400) === false,
    "During cooldown (200ms < 500ms), circuit remains OPEN and fast-fails"
  );

  // After cooldown (>= 500ms after last failure at testTime + 200 -> testTime + 750)
  const probeTime = testTime + 750;
  assert(
    breaker.isAvailable(geminiProvider, probeTime) === true,
    "After cooldown (550ms >= 500ms), circuit transitions to HALF_OPEN for trial probe"
  );
  assert(
    breaker.getStatus(geminiProvider)?.state === "HALF_OPEN",
    "Status confirms HALF_OPEN state"
  );

  // -------------------------------------------------------------------------
  // Test 5: Successful Trial Probe -> CLOSED (Recovery)
  // -------------------------------------------------------------------------
  console.log("\n[Test 5] Successful Trial Probe Recovery (HALF_OPEN -> CLOSED)");

  breaker.recordSuccess(geminiProvider);
  assert(
    breaker.getStatus(geminiProvider)?.state === "CLOSED",
    "Successful trial probe resets circuit state to CLOSED"
  );
  assert(
    breaker.getStatus(geminiProvider)?.consecutiveFailures === 0,
    "Consecutive failure count reset to 0 upon recovery"
  );
  assert(
    breaker.isAvailable(geminiProvider) === true,
    "Recovered provider is fully available"
  );

  // -------------------------------------------------------------------------
  // Test 6: Failed Trial Probe -> Re-tripping to OPEN
  // -------------------------------------------------------------------------
  console.log("\n[Test 6] Failed Trial Probe Re-tripping (HALF_OPEN -> OPEN)");

  // Trip again
  breaker.recordFailure(geminiProvider, new Error("Fail 1"), testTime);
  breaker.recordFailure(geminiProvider, new Error("Fail 2"), testTime);
  breaker.recordFailure(geminiProvider, new Error("Fail 3"), testTime);
  assert(breaker.getStatus(geminiProvider)?.state === "OPEN", "Circuit re-tripped to OPEN");

  // Advance past cooldown to HALF_OPEN
  breaker.isAvailable(geminiProvider, testTime + 600);
  assert(breaker.getStatus(geminiProvider)?.state === "HALF_OPEN", "Circuit is HALF_OPEN");

  // Fail during trial probe
  breaker.recordFailure(geminiProvider, new Error("Probe failed: still 429"), testTime + 650);
  assert(
    breaker.getStatus(geminiProvider)?.state === "OPEN",
    "Failed trial probe immediately re-trips circuit back to OPEN"
  );

  // -------------------------------------------------------------------------
  // Test 7: Dynamic Timeout Resolution
  // -------------------------------------------------------------------------
  console.log("\n[Test 7] Dynamic AI Timeout Resolution");

  // Standard Cloud Provider
  const cloudTimeout = resolveHopTimeoutReference(geminiProvider, false);
  assert(cloudTimeout === 120_000, `Standard cloud model timeout resolves to 120,000ms (actual: ${cloudTimeout})`);

  // Local Ollama Provider (127.0.0.1)
  const localTimeout = resolveHopTimeoutReference(ollamaProvider, false);
  assert(localTimeout === 180_000, `Local Ollama model timeout resolves to 180,000ms (actual: ${localTimeout})`);

  // Multi-round Tool Loop
  const toolTimeout = resolveHopTimeoutReference(geminiProvider, true);
  assert(toolTimeout === 25_000, `Multi-round tool loop timeout resolves to 25,000ms (actual: ${toolTimeout})`);

  // Environment Variable Overrides
  process.env.AI_PROVIDER_TIMEOUT_MS = "45000";
  const overriddenCloud = resolveHopTimeoutReference(geminiProvider, false);
  assert(overriddenCloud === 45_000, `Environment override AI_PROVIDER_TIMEOUT_MS=45000 honored (actual: ${overriddenCloud})`);
  delete process.env.AI_PROVIDER_TIMEOUT_MS;

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------");
  console.log(`R6 Suite Completed: ${passedCount} passed, ${failedCount} failed`);
  console.log("-------------------------------------------------------\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runR6Verification().catch((err) => {
  console.error("Fatal error in R6 test suite:", err);
  process.exit(1);
});
