# atTrack Desktop Hardening Test Infrastructure (R1–R9)

This document specifies the 4-tier testing architecture, verification matrix, and test automation suite for atTrack across all 9 hardening dimensions (R1–R9).

---

## 1. 4-Tier Test Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Tier 4: E2E Master Orchestration (scripts/verify-all-hardening.ts)      │
├─────────────────────────────────────────────────────────────────────────┤
│ Tier 3: Subsystem Integration & Process Lifecycle Tests                 │
│         - Port Binding & Socket Discovery (verify-r1)                   │
│         - Server Lifecycle & Async Graceful Shutdown (verify-r2)        │
│         - SQLite WAL Checkpointing & Safety (verify-r3)                 │
│         - Packaging & Native Artifact Validation (verify-r5)            │
├─────────────────────────────────────────────────────────────────────────┤
│ Tier 2: Unit & State Machine Contract Verification                      │
│         - Extension Multi-Browser CORS & Offline Queue TTL (verify-r4)  │
│         - AI Circuit Breaker, Cooldown & Timeouts (verify-r6)           │
│         - Loopback Middleware & Bulletproof SSRF Filter (verify-r7-r8)  │
│         - Cross-Platform Titlebar Styling & Platform Tokens (verify-r9) │
├─────────────────────────────────────────────────────────────────────────┤
│ Tier 1: Static Analysis, Type Soundness & Build Validation              │
│         - TypeScript (`npm run typecheck`)                              │
│         - Next.js Production Compilation (`npm run build`)              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Static Analysis & Type Soundness
- **Objective**: Verify that all interfaces, types, and schema migrations compile with zero errors under strict TypeScript compiler rules.
- **Commands**: `npm run typecheck`, `npm run lint`.

### Tier 2: Unit & State Machine Contract Verification
- **Objective**: Test deterministic algorithms, state machines, regex filters, and security boundaries in complete isolation.
- **Modules Covered**:
  - `validateSqliteDir`: UNC paths, network drives, and cloud sync folders (OneDrive, Dropbox, iCloud, etc.).
  - `validatePublicUrl` / SSRF protection: IPv4/IPv6 private ranges, decimal/hex IP encodings, loopback, link-local, cloud metadata, DNS rebinding.
  - `AiCircuitBreaker`: CLOSED -> OPEN -> HALF_OPEN transitions, consecutive failure tracking, cooldown duration, fast-fail bypass.
  - `getExtensionCorsHeaders`: `chrome-extension://`, `moz-extension://`, `edge-extension://`, `safari-web-extension://`, loopback origins.
  - Extension Offline Queue: 24h TTL eviction, 100-item FIFO cap, 500KB item payload guard.

### Tier 3: Subsystem Integration & Process Lifecycle Tests
- **Objective**: Verify real OS socket binding, child process signal propagation, database lock contention, and build artifact composition.
- **Modules Covered**:
  - Socket probe with `{ exclusive: true }` across port ladder `[3788..3795]`.
  - Process exit detection and non-blocking diagnostic log buffer.
  - Async graceful shutdown: `SIGTERM` -> 5000ms await -> `SIGKILL` escalation.
  - SQLite `busy_timeout = 60000`, `wal_autocheckpoint = 1000`, and `closeDb()` checkpointing.
  - Standalone build structure: verification of `vec0.dll`/`vec0.dylib`/`vec0.so` and `node_modules` completeness.

### Tier 4: E2E Master Orchestration
- **Objective**: Single-command execution of all hardening test suites with consolidated status reporting.
- **Master Script**: `npx tsx scripts/verify-all-hardening.ts`.

---

## 2. Hardening Dimension Test Matrix (R1–R9)

| Dimension | Scope | Test Script | Verification Focus |
|---|---|---|---|
| **R1** | Port Binding & Discovery | `scripts/verify-r1-port-discovery.ts` | Candidate port ladder `[3788..3795]`, exclusive socket check, active server manifest synchronization. |
| **R2** | Server Lifecycle & Logs | `scripts/verify-r2-server-lifecycle.ts` | Premature exit detection in `waitForReady`, lossless log buffer, async SIGTERM -> 5s -> SIGKILL shutdown. |
| **R3** | SQLite Safety & Lifecycle | `scripts/verify-r3-sqlite-safety.ts` | `validateSqliteDir` UNC rejection and cloud-sync warning, `closeDb()` WAL truncation, `busy_timeout = 60000`. |
| **R4** | Extension CORS & Queue | `scripts/verify-r4-extension-cors-queue.ts` | Multi-browser CORS headers, 24h queue TTL, 100-item queue bound, automated secret rotation Server Action. |
| **R5** | Packaging & Artifacts | `scripts/verify-r5-packaging-artifacts.ts` | Native `sqlite-vec` binary validation (`vec0.dll`/`vec0.dylib`/`vec0.so`), node_modules sanity, tracer exclusions. |
| **R6** | AI Circuit Breaker | `scripts/verify-r6-ai-circuit-breaker.ts` | Consecutive failure threshold, 60s cooldown, OPEN fast-fail bypass, configurable timeout resolution. |
| **R7** | Memory & Virtual Tables | `scripts/verify-r7-r8-r9-security-memory.ts` | `--max-old-space-size=4096` spawn args, in-memory cached `ensureVirtualTables`. |
| **R8** | Local Security & SSRF | `scripts/verify-r7-r8-r9-security-memory.ts` | Loopback Host header middleware enforcement, SSRF filter blocking decimal/hex IPs, IPv6 mapped, cloud metadata, DNS rebinding. |
| **R9** | Cross-Platform Titlebar | `scripts/verify-r7-r8-r9-security-memory.ts` | Platform-aware window titlebar (macOS traffic light `pl-20`, Linux fallback controls, Windows WCO space). |

---

## 3. Running Test Suites

### Individual Dimension Test Execution
```bash
# R1: Port Discovery & Socket Probe
npx tsx scripts/verify-r1-port-discovery.ts

# R2: Server Lifecycle & Async Shutdown
npx tsx scripts/verify-r2-server-lifecycle.ts

# R3: SQLite Safety & Pre-flight Validation
npx tsx scripts/verify-r3-sqlite-safety.ts

# R4: Extension CORS & Offline Queue Resiliency
npx tsx scripts/verify-r4-extension-cors-queue.ts

# R5: Standalone Packaging & Native Binary Verification
npx tsx scripts/verify-r5-packaging-artifacts.ts

# R6: AI Task Chain Circuit Breaker & Timeouts
npx tsx scripts/verify-r6-ai-circuit-breaker.ts

# R7, R8, R9: Memory Limits, Loopback Middleware, SSRF & Titlebar
npx tsx scripts/verify-r7-r8-r9-security-memory.ts
```

### Complete Hardening Test Suite Execution
```bash
npx tsx scripts/verify-all-hardening.ts
```
