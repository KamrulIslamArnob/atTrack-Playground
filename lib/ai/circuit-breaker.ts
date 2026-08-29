import type { ProviderType } from "@/lib/types/ai-providers";

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface ProviderCircuit {
  providerId: string;
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  lastError: string | null;
  probeInFlight: boolean;
}

export const DEFAULT_FAILURE_THRESHOLD = 3;
export const DEFAULT_COOLDOWN_MS = 60_000;
export const DEFAULT_HOP_TIMEOUT_MS = 120_000;
export const DEFAULT_LOCAL_HOP_TIMEOUT_MS = 180_000;
export const DEFAULT_CLOUD_HOP_TIMEOUT_MS = 60_000;
export const DEFAULT_TOOL_ROUND_TIMEOUT_MS = 25_000;

function getFailureThreshold(): number {
  if (typeof process !== "undefined" && process.env?.AI_CIRCUIT_FAILURE_THRESHOLD) {
    const val = parseInt(process.env.AI_CIRCUIT_FAILURE_THRESHOLD, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return DEFAULT_FAILURE_THRESHOLD;
}

function getCooldownMs(): number {
  if (typeof process !== "undefined" && process.env?.AI_CIRCUIT_COOLDOWN_MS) {
    const val = parseInt(process.env.AI_CIRCUIT_COOLDOWN_MS, 10);
    if (!isNaN(val) && val > 0) return val;
  }
  return DEFAULT_COOLDOWN_MS;
}

const circuits = new Map<string, ProviderCircuit>();

function getOrCreateCircuit(providerId: string): ProviderCircuit {
  const existing = circuits.get(providerId);
  if (existing) return existing;
  const created: ProviderCircuit = {
    providerId,
    state: "CLOSED",
    consecutiveFailures: 0,
    lastFailureTime: null,
    lastSuccessTime: null,
    lastError: null,
    probeInFlight: false,
  };
  circuits.set(providerId, created);
  return created;
}

/**
 * Checks if the provider circuit is available for a request.
 * - CLOSED: Available.
 * - OPEN: Fast-fails immediately if in cooldown; if cooldown elapsed, transitions to HALF_OPEN and allows 1 probe.
 * - HALF_OPEN: Allows 1 probe request; other concurrent requests fast-fail until probe completes.
 */
export function isProviderAvailable(providerId: string): boolean {
  if (!providerId) return true;
  const circuit = circuits.get(providerId);
  if (!circuit) return true;

  if (circuit.state === "CLOSED") {
    return true;
  }

  const cooldownMs = getCooldownMs();

  if (circuit.state === "OPEN") {
    const elapsed = circuit.lastFailureTime ? Date.now() - circuit.lastFailureTime : Infinity;
    if (elapsed >= cooldownMs) {
      // Cooldown period elapsed -> transition to HALF_OPEN for 1 probe request
      circuit.state = "HALF_OPEN";
      circuit.probeInFlight = true;
      return true;
    }
    // Fast-fail: still within cooldown window
    return false;
  }

  if (circuit.state === "HALF_OPEN") {
    if (!circuit.probeInFlight) {
      circuit.probeInFlight = true;
      return true;
    }
    // Probe is already in flight; fast-fail other requests
    return false;
  }

  return true;
}

/**
 * Records a successful response from a provider route.
 * Resets failures to 0 and transitions circuit to CLOSED.
 */
export function recordProviderSuccess(providerId: string): void {
  if (!providerId) return;
  const circuit = getOrCreateCircuit(providerId);
  circuit.state = "CLOSED";
  circuit.consecutiveFailures = 0;
  circuit.lastSuccessTime = Date.now();
  circuit.lastError = null;
  circuit.probeInFlight = false;
}

/**
 * Records a failure from a provider route.
 * Increments consecutive failures and transitions to OPEN if threshold reached or if probe failed.
 */
export function recordProviderFailure(providerId: string, error?: unknown): void {
  if (!providerId) return;
  const circuit = getOrCreateCircuit(providerId);
  const failureThreshold = getFailureThreshold();
  const errMsg =
    error instanceof Error ? error.message : typeof error === "string" ? error : String(error ?? "Unknown error");

  circuit.lastFailureTime = Date.now();
  circuit.lastError = errMsg;
  circuit.consecutiveFailures += 1;
  circuit.probeInFlight = false;

  if (circuit.state === "HALF_OPEN") {
    // Probe request failed -> back to OPEN
    circuit.state = "OPEN";
  } else if (circuit.consecutiveFailures >= failureThreshold) {
    // Threshold reached -> transition to OPEN
    circuit.state = "OPEN";
  }
}

/**
 * Resets a provider circuit to CLOSED state with 0 failures.
 */
export function resetProviderCircuit(providerId: string): void {
  if (!providerId) return;
  const circuit = circuits.get(providerId);
  if (circuit) {
    circuit.state = "CLOSED";
    circuit.consecutiveFailures = 0;
    circuit.lastFailureTime = null;
    circuit.lastError = null;
    circuit.probeInFlight = false;
  }
}

/**
 * Resets all tracked provider circuits.
 */
export function resetAllCircuits(): void {
  circuits.clear();
}

/**
 * Gets remaining cooldown in milliseconds for an OPEN circuit.
 */
export function getProviderCooldownRemaining(providerId: string): number {
  if (!providerId) return 0;
  const circuit = circuits.get(providerId);
  if (!circuit || circuit.state === "CLOSED") return 0;
  const cooldownMs = getCooldownMs();
  const elapsed = circuit.lastFailureTime ? Date.now() - circuit.lastFailureTime : Infinity;
  return Math.max(0, cooldownMs - elapsed);
}

/**
 * Gets the current circuit state snapshot for a provider.
 */
export function getCircuitBreakerStatus(providerId: string): ProviderCircuit {
  return { ...getOrCreateCircuit(providerId) };
}

/**
 * Gets all tracked circuit breaker states.
 */
export function getAllCircuitStatuses(): Record<string, ProviderCircuit> {
  const result: Record<string, ProviderCircuit> = {};
  for (const [id, circuit] of circuits.entries()) {
    result[id] = { ...circuit };
  }
  return result;
}

const LOCAL_HOST_PATTERNS = [
  /localhost/i,
  /127\.\d+\.\d+\.\d+/,
  /0\.0\.0\.0/,
  /::1/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /:(11434|1234|8000|8080|5000)/,
];

/**
 * Identifies whether a provider points to a locally hosted LLM service (Ollama, LM Studio, local vLLM).
 */
export function isLocalProvider(
  provider?: { provider_type?: ProviderType | string; base_url?: string | null; model?: string } | string
): boolean {
  if (!provider) return false;
  if (typeof provider === "string") {
    return LOCAL_HOST_PATTERNS.some((re) => re.test(provider)) || /local|ollama|lmstudio/i.test(provider);
  }
  if (provider.provider_type === "gemini" || provider.provider_type === "anthropic") {
    return false;
  }
  if (provider.base_url) {
    if (LOCAL_HOST_PATTERNS.some((re) => re.test(provider.base_url!))) {
      return true;
    }
  }
  if (provider.model && /local|ollama|lmstudio/i.test(provider.model)) {
    return true;
  }
  return false;
}

/**
 * Resolves the appropriate hop timeout in milliseconds:
 * - Environment override `AI_HOP_TIMEOUT_MS` takes precedence.
 * - Local models receive 180,000ms.
 * - Cloud models receive 60,000ms.
 * - Fallback default is 120,000ms.
 */
export function resolveHopTimeout(
  provider?: { provider_type?: ProviderType | string; base_url?: string | null; model?: string } | string,
  defaultMs?: number
): number {
  if (typeof process !== "undefined" && process.env?.AI_HOP_TIMEOUT_MS) {
    const envVal = parseInt(process.env.AI_HOP_TIMEOUT_MS, 10);
    if (!isNaN(envVal) && envVal > 0) return envVal;
  }

  if (provider) {
    if (isLocalProvider(provider)) {
      return DEFAULT_LOCAL_HOP_TIMEOUT_MS;
    }
    if (
      (typeof provider === "object" && (provider.provider_type === "gemini" || provider.provider_type === "anthropic")) ||
      (typeof provider === "object" && provider.base_url && !isLocalProvider(provider))
    ) {
      return DEFAULT_CLOUD_HOP_TIMEOUT_MS;
    }
  }

  return defaultMs ?? DEFAULT_HOP_TIMEOUT_MS;
}

/**
 * Resolves the timeout for tool-selection rounds:
 * - Environment override `AI_TOOL_ROUND_TIMEOUT_MS` takes precedence.
 * - Default is 25,000ms.
 */
export function resolveToolRoundTimeout(): number {
  if (typeof process !== "undefined" && process.env?.AI_TOOL_ROUND_TIMEOUT_MS) {
    const envVal = parseInt(process.env.AI_TOOL_ROUND_TIMEOUT_MS, 10);
    if (!isNaN(envVal) && envVal > 0) return envVal;
  }
  return DEFAULT_TOOL_ROUND_TIMEOUT_MS;
}

// Aliases matching PROJECT.md interface contract
export const recordSuccess = recordProviderSuccess;
export const recordFailure = recordProviderFailure;
export const isAvailable = isProviderAvailable;
export const resetCircuit = resetProviderCircuit;
