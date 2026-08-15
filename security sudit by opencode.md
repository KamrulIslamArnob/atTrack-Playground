# Security Audit Report — atTrack

**Date:** 2026-08-14  
**Auditor:** OpenCode (automated)  
**Scope:** Full codebase — Next.js 16 app, Electron desktop wrapper, Chrome extension, SQLite database  
**Trust model:** Local-first, single-user app

---

## CRITICAL

| # | Finding | Location |
|---|---------|----------|
| C-1 | **Full DB dump, no auth** — `GET /api/database` returns all tables/data unauthenticated | `app/api/database/route.ts:34-75` |
| C-2 | **Arbitrary DB mutation** — `PUT /api/database/update` writes any column via raw SQL (identifier validation only, no auth) | `app/api/database/update/route.ts:31-93` |
| C-3 | **Hardcoded AES fallback key** — static dev key `0123456789abcdef...` encrypts SMTP/AI keys at rest, committed to public repo | `lib/encryption.ts:6` |
| C-4 | **PII in source** — `connect.arnob@gmail.com` hardcoded + real PDF resumes with personal info in repo | `lib/db/local-user.ts:10`, `public/resume/*.pdf` |
| C-5 | **Extension CORS `*`** — any website can call local API to add/scrape jobs (extension has `<all_urls>` permission) | `app/api/extension/add-job/route.ts:7`, `parse-job-ai/route.ts:7`, `status/route.ts:5` |
| C-6 | **`tar` arbitrary file overwrite** — vulnerable transitive dep allows symlink/traversal attacks | `node_modules/tar` (update to v7.5.21+) |

## HIGH

| # | Finding | Location |
|---|---------|----------|
| H-1 | **No rate limiting** — AI endpoints (`/api/ai/*`, `/api/chat`) callable for token exhaustion/cost abuse | all AI routes |
| H-2 | **No auth on extension routes** — `getUser()` silently returns local owner; any local process can call | `app/api/extension/*.ts` |
| H-3 | **Client-supplied Firecrawl key** — server proxies scraping with attacker-supplied API key | `app/api/extension/parse-job-ai/route.ts:27` |
| H-4 | **Electron IPC leaks system paths** — `getSystemPerformance` exposes full filesystem layout, userData dir, exe path | `electron/main.js:150-223` |
| H-5 | **`allowedOrigins: 192.168.*`** — any LAN device can submit server actions in dev mode | `next.config.ts:37` |
| H-6 | **`pdfjs-dist` arbitrary JS execution** — malicious PDF → RCE in Node.js context (server-side parsing) | `package.json:34` (GHSA-wgrm-67xf-hhpq, CVSS 8.8) |
| H-7 | **`postcss`/`sharp`/`nanoid`/`hono`/`next`** — known CVEs in transitive deps | various (update next to 16.3.1+) |

## MEDIUM

| # | Finding | Location |
|---|---------|----------|
| M-1 | **No security headers** — missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy | `next.config.ts` |
| M-2 | **Extension `<all_urls>` host_permissions** — content script injected into every page, all browsing data accessible | `extension/manifest.json:29` |
| M-3 | **innerHTML with external data** — parsed job HTML from arbitrary pages injectable into extension popup | `extension/popup/popup.js:332` |
| M-4 | **Verbose logging of scraped data** — job titles, companies, salaries logged to stdout | `lib/services/firecrawl.ts:32-106` |
| M-5 | **No CSRF protection** — POST/PUT state-changing routes unprotected; CORS `*` enables cross-origin CSRF | all state-changing routes |
| M-6 | **electron-updater no signature verification** — no public key configured, GitHub account compromise → malicious updates | `electron/main.js:228-291`, `electron-builder.json` |

## LOW

- `innerHTML` with static strings in popup (no user data)
- Version and userId exposed in `/api/extension/status`
- AES key derivation pads short keys with `0x00` (weak key possible)
- `encrypted_password` column is vestigial placeholder (`"local"`, not a real hash)
- Build output path `C:/Users/Kamru/AtTrack-Release` leaks Windows username
- No HTTPS (acceptable for local-only, risk if port exposed)

## Positive Security Observations

- **SQL injection protection** — SQLite parameterized queries + identifier whitelist via `quoteIdent()` (`lib/db/query.ts`)
- **Path traversal protection** — `safeKey()` rejects `..`, absolute paths, drive letters (`lib/db/storage.ts:46-56`)
- **Electron hardening** — `contextIsolation: true`, `nodeIntegration: false`, minimal preload with whitelisted IPC channels
- **Secrets at rest** — `electron/settings.js` uses `safeStorage` (OS keychain/DPAPI) for `encryptionKey` and `geminiApiKey`
- **Delete guard** — refuses unfiltered `DELETE` without WHERE clause (`lib/db/query.ts:548-553`)
- **No `dangerouslySetInnerHTML`** — zero uses in React frontend

---

## Recommended Fixes (Priority Order)

### Immediate (Critical/High)

1. **Update vulnerable dependencies**
   ```bash
   npm update tar                    # CVE: arbitrary file overwrite
   npm install next@16.3.1           # pulls patched postcss, sharp
   npm update pdfjs-dist             # malicious PDF → RCE
   ```

2. **Remove hardcoded encryption key** — generate per-install random key, persist via `safeStorage` or user-scoped config

3. **Scrub PII from repo** — remove `public/resume/*.pdf`, replace `OWNER_EMAIL` placeholder, add to `.gitignore`, use `git filter-repo` to remove from history

4. **Restrict extension API CORS** — remove `Access-Control-Allow-Origin: *`; require extension-origin header or shared secret

5. **Don't accept client-supplied Firecrawl key** — server should only use `process.env.FIRECRAWL_API_KEY`

### High Priority

6. **Add CSP and security headers** in `next.config.ts`:
   ```ts
   async headers() {
     return [{ source: "/(.*)", headers: [
       { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;" },
       { key: "X-Frame-Options", value: "DENY" },
       { key: "X-Content-Type-Options", value: "nosniff" },
       { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
     ]};
   }
   ```

7. **Narrow `allowedOrigins`** — remove `192.168.*` wildcard, keep only `localhost` + `127.0.0.1` variants

8. **Rate-limit AI endpoints** — per-session token budget caps, especially for paid LLM calls

9. **Add CSRF protection** — tokens for state-changing routes, or require shared secret for extension API calls

### Medium Priority

10. **Fix `extension/popup/popup.js:332`** — use `textContent` instead of `innerHTML` with external data:
    ```js
    // Before
    tag.innerHTML = `${skill} <span class="tag-remove">&times;</span>`;
    // After
    tag.textContent = skill;
    const remove = document.createElement("span");
    remove.className = "tag-remove";
    remove.textContent = "×";
    tag.appendChild(remove);
    ```

11. **Reduce Electron IPC system info** — only return what UI needs; remove `exePath`, `rootFolder`, `userDataDir` from `getSystemPerformance`

12. **Add signature verification** to electron-updater (`publisherName`, public key)

13. **Sanitize Firecrawl logging** — avoid logging full job data in production

---

*End of report.*
