# Contributing to Aven / AtTrack

Thank you for your interest in contributing to **Aven**! We welcome contributions to make this personal career workspace and job tracking platform better for everyone.

This guide outlines our development workflow, open-source standards, and security policies.

---

## 🔒 Open Source Security: What to Push vs. What NOT to Push

Security and user privacy are paramount. Before creating a Pull Request or committing changes, strictly review the rules below:

### ❌ What MUST NOT Be Pushed (Never Commit These!)

| Category | Description & Examples | Why it's prohibited |
|---|---|---|
| **Secret API Keys & Tokens** | Real API keys in `.env.local` or source files (`OPENROUTER_API_KEY`, `GEMINI_API_KEY`, `SMTP_ENCRYPTION_KEY`, OAuth tokens, Bearer tokens). | Exposes billing accounts, leaks private APIs, security risk. |
| **Local User Databases** | Files in `.data/` directory (`.data/attrack.db`, `.data/attrack.db-wal`, SQLite journals). | Contains private job search data, resume texts, email history, credentials. |
| **User Documents & Uploads** | Files uploaded into `.data/storage/` or local test PDFs/resumes. | Contains private personal information. |
| **Compiled Binaries & Build Artifacts** | Folders `/release/`, `/.next/`, `/out/`, `/build/`, `*.tsbuildinfo`, `node_modules/`. | Bloats repository, platform-dependent, generated automatically by CI/CD. |
| **SSL Certificates & Keys** | Any `*.pem`, `*.key`, or private TLS certificates. | Compromises local network security. |
| **IDE / Agent Temp Files** | `.claude/`, `.superpowers/`, `.playwright-mcp/`, `.DS_Store`, log files (`*.log`). | Dirty workspace noise and environment-specific artifacts. |

> [!CAUTION]
> If you accidentally commit a real API key or private data:
> 1. Immediately revoke/rotate the compromised key in your service provider dashboard.
> 2. Remove the commit from your git history before pushing.

---

### ✅ What SHOULD Be Pushed (Safe & Encouraged)

| Category | Description | Examples |
|---|---|---|
| **Source Code** | Clean, well-typed application code. | `app/`, `components/`, `lib/`, `electron/`, `scripts/` |
| **Database Schemas & Migrations** | Idempotent SQL schema files and database migrations. | `lib/db/schema.sql`, `lib/db/meta.ts` |
| **Documentation & Assets** | Public markdown documentation, public UI SVG icons/images. | `README.md`, `docs/`, `public/` |
| **Tests & Verification** | Self-check suites and test files. | `lib/db/selfcheck.ts` |
| **Configuration Files** | ESLint, TypeScript, Next.js, Electron Builder configs. | `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `electron-builder.json` |

---

## 🛠️ Local Development Setup

### Prerequisites
- **Node.js**: v20 or later
- **npm**: v10 or later

### Step-by-Step Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/aven.git
   cd aven
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run Web Dev Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

4. **Run Electron Desktop App:**
   ```bash
   npm run electron:dev
   ```

---

## 🧪 Code Quality & Verification Checklist

Before submitting a Pull Request, ensure your changes satisfy all quality checks:

1. **Type Check:**
   ```bash
   npx tsc --noEmit
   ```
   *Must exit with 0 errors.*

2. **Database Layer Self-Check:**
   ```bash
   npx tsx lib/db/selfcheck.ts
   ```
   *Must pass all 27/27 query builder checks.*

3. **Linting:**
   ```bash
   npm run lint
   ```
   *Must exit with 0 errors and zero warnings.*

4. **Production Build Verification:**
   ```bash
   npm run build
   ```
   *Must compile successfully for all App Router routes.*

---

## 🌿 Git Branch & Pull Request Guidelines

1. **Branch Naming Conventions:**
   - `feature/short-description` for new features
   - `fix/short-description` for bug fixes
   - `docs/short-description` for documentation improvements
   - `refactor/short-description` for code cleanup

2. **Commit Messages:**
   Use clear, conventional commit messages:
   - `feat: add document export functionality`
   - `fix: resolve state update in email composer`
   - `docs: update setup instructions in README`

3. **Submitting a Pull Request:**
   - Push your branch to your fork.
   - Open a PR against the `main` branch.
   - Include a clear description of the changes made and link any related issues.
