# Project: atTrack (BetterJob) Desktop Architectural Hardening (R1–R9)

## Architecture
- **Desktop Host & Server Process Lifecycle Layer** (`electron/`): Electron main process managing single-instance lock, candidate port probing (`[3788..3795]`), synchronized port manifest storage, child process spawn with `--max-old-space-size=4096`, premature exit detection, lossless log forwarding, and async graceful shutdown (SIGTERM -> 5s -> SIGKILL).
- **Local SQLite Data Safety & Storage Layer** (`lib/db/`): High-concurrency SQLite with WAL mode, `busy_timeout = 60000`, `wal_autocheckpoint = 1000`, pre-flight data directory validation preventing database placement on UNC shares or active cloud-sync folders (OneDrive, Dropbox, iCloud), in-memory cached virtual table checks (`ensureVirtualTables`), and clean connection shutdown checkpointing (`closeDb()`).
- **Extension Integration & Offline Resiliency Layer** (`extension/`, `lib/db/extension-cors.ts`, `lib/actions/extension.ts`): Multi-browser extension CORS support (`chrome-extension://*`, `moz-extension://*`, `edge-extension://*`, `safari-web-extension://*`), automated auth secret rotation and pairing handshake, and 24-hour TTL / 100-item capped offline queue in browser local storage.
- **AI Provider Chain & Circuit Breaker Layer** (`lib/ai/`): Task-routed provider chain equipped with configurable hop/tool timeouts, consecutive failure tracking, 60s cooldown circuit breaker, fast-fail bypass, and persistent error state recovery.
- **Local Security & SSRF Defense Layer** (`middleware.ts`, `lib/security/ssrf.ts`): Strict loopback Host header and Origin enforcement on local endpoints (`127.0.0.1`, `localhost`, `[::1]`), and robust SSRF URL sanitization (blocking octal/hex/decimal IP encodings, IPv6 mapped addresses, cloud metadata, and DNS rebinding wildcards) across all scraping and external fetch integrations.
- **Standalone Packaging & Cross-Platform Window Hygiene Layer** (`scripts/`, `next.config.ts`, `build/`, `components/window-titlebar.tsx`): Complete `.next/standalone` bundling with verified native platform binaries (`sqlite-vec-windows-x64/vec0.dll`, darwin, linux), standalone tracer exclusions (`release/`, `build/`), platform-aware window titlebar styling (macOS traffic light spacing, Linux fallbacks), and NSIS uninstaller user data cleanup options.

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|--------|
| 1 | Port Candidate Synchronization | Aligned candidate port list `[3788..3795]` across Electron and companion extension | M1 | ORIGINAL_REQUEST §R1 | PLANNED |
| 2 | Exclusive Socket Port Probe | Port availability check using `{ exclusive: true }` sockets and live port manifest sync | M1 | ORIGINAL_REQUEST §R1 | PLANNED |
| 3 | Fast-Fail Server Startup & Log Buffering | Instant premature exit detection during boot polling with lossless stdout/stderr buffer | M1 | ORIGINAL_REQUEST §R2 | PLANNED |
| 4 | Async Graceful Server Shutdown | Async `stopServer` sending SIGTERM, awaiting termination up to 5s, escalating to SIGKILL | M1 | ORIGINAL_REQUEST §R2 | PLANNED |
| 5 | SQLite Directory Pre-Flight Validation | Detect & reject UNC paths (`\\...`) and warn on cloud sync folders (OneDrive, Dropbox, iCloud) | M2 | ORIGINAL_REQUEST §R3 | PLANNED |
| 6 | Safe DB Close & Checkpoint Hook | Exported `closeDb()` with `PRAGMA wal_checkpoint(TRUNCATE)` for safe Windows file operations | M2 | ORIGINAL_REQUEST §R3 | PLANNED |
| 7 | SQLite Pragmas Tuning | Configured `busy_timeout = 60000` and `wal_autocheckpoint = 1000` for concurrent stability | M2 | ORIGINAL_REQUEST §R3 | PLANNED |
| 8 | Multi-Browser Extension CORS Whitelist | Expanded CORS headers supporting Chrome, Firefox, Edge, and Safari extension schemes | M3 | ORIGINAL_REQUEST §R4 | PLANNED |
| 9 | Offline Queue TTL & Bound Enforcement | 24h expiration TTL and 100-item / 500KB cap on pending jobs in `chrome.storage.local` | M3 | ORIGINAL_REQUEST §R4 | PLANNED |
| 10 | Automated Secret Rotation & Pairing | Server Action to rotate extension bearer secret with UI broadcast handshake | M3 | ORIGINAL_REQUEST §R4 | PLANNED |
| 11 | Standalone Native Binary Verification | `prepare-electron-build.js` platform binary validation (`vec0.dll`/`vec0.dylib`/`vec0.so`) | M4 | ORIGINAL_REQUEST §R5 | PLANNED |
| 12 | Standalone Tracer Exclusions | Exclude `release/` and `build/` from standalone output file tracing in `next.config.ts` | M4 | ORIGINAL_REQUEST §R5 | PLANNED |
| 13 | AI Circuit Breaker & Cooldown | Track consecutive provider failures, apply 60s cooldown before cascading, fast-fail OPEN state | M5 | ORIGINAL_REQUEST §R6 | PLANNED |
| 14 | Dynamic AI Timeouts & Error Recovery | Configurable hop/tool timeouts and persistent UI assistant error recovery in chat queue | M5 | ORIGINAL_REQUEST §R6 | PLANNED |
| 15 | Node Child Process Memory Limits | `--max-old-space-size=4096` heap limit on Next.js server child process | M6 | ORIGINAL_REQUEST §R7 | PLANNED |
| 16 | Virtual Table Existence Caching | In-memory cached `ensureVirtualTables` skipping redundant DDL queries | M6 | ORIGINAL_REQUEST §R7 | PLANNED |
| 17 | Root Loopback & Origin Middleware | `middleware.ts` restricting Host to loopback (`127.0.0.1`, `localhost`, `[::1]`) | M6 | ORIGINAL_REQUEST §R8 | PLANNED |
| 18 | Centralized SSRF Protection | Validator blocking decimal/hex IPs, IPv6 mapped/unique-local, and DNS rebinding hosts | M6 | ORIGINAL_REQUEST §R8 | PLANNED |
| 19 | Cross-Platform Titlebar & NSIS Hygiene | Titlebar macOS traffic light padding (`pl-20`), Linux fallbacks, and NSIS data prompt | M6 | ORIGINAL_REQUEST §R9 | PLANNED |
| 20 | Complete E2E Hardening Verification | Standalone verification scripts testing port fallback, DB locking, CORS, SSRF, circuit breaker | M7 | ORIGINAL_REQUEST §Verification | PLANNED |

## Milestones
| # | Name | Scope | Dependencies | Status | Key Outputs |
|---|------|-------|-------------|--------|-------------|
| 1 | Port Negotiation & Server Process Lifecycle (R1, R2) | `electron/main.js`, `electron/server.js`, `extension/background/service-worker.js` | none | PLANNED | Port candidate alignment `[3788..3795]`, exclusive socket probe, instant exit detection, async SIGTERM->SIGKILL shutdown |
| 2 | SQLite Data Safety & Connection Lifecycle (R3) | `lib/db/sqlite.ts`, `electron/data-dir.js` | none | PLANNED | `validateSqliteDir`, `closeDb()` checkpoint, tuned pragmas, safe file restructuring |
| 3 | Extension Communication, CORS & Queue TTL (R4) | `lib/db/extension-cors.ts`, `extension/background/service-worker.js`, `lib/actions/extension.ts`, `components/settings/extension-settings.tsx` | none | PLANNED | Multi-browser CORS, 24h TTL / 100-item queue cap, secret rotation Server Action & UI |
| 4 | Standalone Packaging & Platform Dependencies (R5) | `scripts/prepare-electron-build.js`, `next.config.ts`, `package.json` | none | PLANNED | Native binary validation (`vec0.dll`), standalone `node_modules` sanity check, tracer exclusions |
| 5 | AI Circuit Breaker, Timeouts & Error Recovery (R6) | `lib/ai/circuit-breaker.ts`, `lib/ai/providers.ts`, `lib/ai-chatbot/chat-queue-context.tsx` | none | PLANNED | Circuit breaker state machine, configurable timeouts, chat queue error persistence |
| 6 | Memory, Security, SSRF & Window Hygiene (R7, R8, R9) | `electron/server.js`, `middleware.ts`, `lib/security/ssrf.ts`, `lib/services/firecrawl.ts`, `lib/services/native-scrape.ts`, `components/window-titlebar.tsx`, `build/installer.nsh` | M1, M2 | PLANNED | `--max-old-space-size=4096`, cached virtual tables, loopback middleware, centralized SSRF validator, titlebar macOS/Linux styles, NSIS uninstaller |
| 7 | Verification & Packaging Hardening (E2E & Build) | Standalone verification scripts in `scripts/`, `npm run typecheck`, `npm run build`, `npm run electron:build:win` | M1-M6 | PLANNED | 0 type errors, clean production Next build, standalone Windows executable packaging |

## Interface Contracts
### Port & Discovery Synchronization
- `settings.lastPort` and port candidate ladder: `[3788, 3789, 3790, 3791, 3792, 3793, 3794, 3795]`.
- Socket availability check: `net.createServer().listen({ port, host: "127.0.0.1", exclusive: true })`.
- Manifest sync: Electron writes `{ port, updatedAt, pid }` to synchronized data storage; extension service worker probes active port.

### SQLite Safety & Lifecycle
- `validateSqliteDir(dirPath: string): { valid: boolean; warning?: string; error?: string }`
- `closeDb(): void` — executes `PRAGMA wal_checkpoint(TRUNCATE)` and closes `DatabaseSync` connection before process exit or folder migration.

### AI Circuit Breaker
- `recordFailure(providerId: string, error: Error): void`
- `recordSuccess(providerId: string): void`
- `isAvailable(providerId: string): boolean`
- `resolveHopTimeout(providerId: string, defaultMs: number): number`

### SSRF Protection
- `validatePublicUrl(urlStr: string): { valid: boolean; error?: string }` — rejects private IP ranges (IPv4 & IPv6), loopback, decimal/hex IP encodings, link-local, cloud metadata (`169.254.169.254`), and known wildcard DNS rebinding domains (`*.nip.io`, `*.sslip.io`).

## Code Layout
- `electron/main.js`, `electron/server.js`, `electron/data-dir.js`: Desktop host, process lifecycle, port negotiation, and storage.
- `lib/db/sqlite.ts`, `lib/db/extension-cors.ts`, `lib/db/extension-secret.ts`: SQLite connection, pragmas, migrations, and CORS.
- `extension/background/service-worker.js`: Companion browser extension background worker with bounded queue and auto-discovery.
- `lib/actions/extension.ts`, `components/settings/extension-settings.tsx`: Secret rotation Server Action and settings UI.
- `scripts/prepare-electron-build.js`, `scripts/electron-after-pack.js`: Desktop packaging scripts and native binary verification.
- `lib/ai/circuit-breaker.ts`, `lib/ai/providers.ts`: AI routing, circuit breaker, and timeout management.
- `lib/ai-chatbot/chat-queue-context.tsx`: Chat queue error state persistence and fallback handling.
- `middleware.ts`: Loopback and origin validation Next.js middleware.
- `lib/security/ssrf.ts`: Centralized SSRF validation utility.
- `components/window-titlebar.tsx`: Cross-platform window titlebar with macOS and Linux adaptations.
- `build/installer.nsh`: NSIS uninstaller script.
- `scripts/`: Verification test scripts for all 9 dimensions.
