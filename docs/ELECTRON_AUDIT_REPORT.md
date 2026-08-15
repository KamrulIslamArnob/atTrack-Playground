# atTrack Electron Desktop — Comprehensive Audit Report

> **Version:** 1.5.0
> **Date:** 2026-08-15
> **Scope:** Electron auto-update infrastructure, code signing, release pipeline, and cross-platform readiness.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State of Auto-Update Infrastructure](#2-current-state-of-auto-update-infrastructure)
3. [Critical Findings](#3-critical-findings)
4. [macOS-Specific Gaps](#4-macos-specific-gaps)
5. [Folder Structure & Organization Audit](#5-folder-structure--organization-audit)
6. [Complete Remediation Roadmap](#6-complete-remediation-roadmap)
7. [Recommended Configuration](#7-recommended-configuration)
8. [CI/CD Pipeline Design](#8-cicd-pipeline-design)

---

## 1. Executive Summary

atTrack's auto-update **machinery is correctly wired** — electron-updater is properly configured in `electron/main.js`, the IPC bridge exposes the right methods, and the UI has a functional update checker. However, **the update pipeline will fail on most user machines** due to:

- **No Windows code signing** → SmartScreen blocks install & updates
- **No macOS support at all** → no `.dmg` target, no entitlements, no notarization
- **Hardcoded local paths** → build fails on other machines
- **Missing `releaseType`** → electron-builder publishes as draft (invisible to updater)
- **Scattered build assets** → no organized `build/` folder for icons, entitlements, or scripts

**Verdict:** The foundation is solid. With the fixes in this report, the app will auto-update seamlessly on both Windows and macOS.

---

## 2. Current State of Auto-Update Infrastructure

### 2.1 What's Already Correct ✅

| Component | File | Notes |
|---|---|---|
| electron-updater dependency | `package.json:26` | `^6.8.9` — compatible with Electron 43 |
| Auto-updater setup | `electron/main.js:224-287` | `autoDownload: true`, `autoInstallOnAppQuit: true`, 5s startup check |
| IPC bridge | `electron/preload.js:3-11` | `checkForUpdates`, `quitAndInstall`, `onUpdateStatus` all exposed |
| Update UI | `components/settings/update-checker.tsx` | Full state machine: idle → checking → downloading → downloaded → error |
| Type definitions | `lib/types/electron.d.ts:1-7` | `ElectronUpdateStatus` union covers all states |
| Publish provider | `electron-builder.json:8-10` | `provider: "github"` configured |
| afterPack hook | `scripts/electron-after-pack.js` | Copies `.next/standalone` into app resources |

### 2.2 Architecture Flow

```
User launches app
    → electron/main.js:277 setTimeout(checkForUpdatesAndNotify, 5000)
        → autoUpdater checks GitHub Releases for latest.yml
            → If new version: autoDownload → emit "downloaded"
                → UI shows "Restart & Install"
                    → quitAndInstall() → runs new installer → app restarts updated
```

---

## 3. Critical Findings

### 🔴 C1. No Windows Code Signing

**File:** `electron-builder.json`
**Impact:** The #1 reason updates will fail on user machines.

Without a code-signing certificate:
- **First install** → Windows Defender SmartScreen shows "Windows protected your PC"
- **Updates** → new installer blocked → user must click "Run anyway" → most users won't
- **Enterprise environments** → Group Policy may block unsigned executables entirely

**Fix Required:**
- Purchase an **OV (Organization Validation)** or **EV code-signing certificate** (~$200-400/year from DigiCert, Sectigo, etc.)
- Configure `electron-builder.json` to use it:
```json
"win": {
  "sign": "./scripts/sign.js",
  "signingHashAlgorithms": ["sha256"]
}
```
- Or use **SignPath** (free for open source) or **Azure Code Signing** for CI/CD integration

---

### 🔴 C2. Hardcoded Windows-Only Output Path

**File:** `electron-builder.json:5`
```json
"output": "C:/Users/Kamru/AtTrack-Release"
```

**Impact:** Build fails on any machine other than the developer's.

**Fix:** Change to a relative path:
```json
"output": "release"
```

---

### 🔴 C3. Missing `releaseType` — Updates Invisible

**File:** `electron-builder.json:8-10`
```json
"publish": { "provider": "github" }
```

**Impact:** Without `releaseType`, electron-builder defaults to **"draft"**. Draft releases are **not publicly accessible** — `electron-updater` will never find them, and the update check silently returns "already up to date".

**Fix:**
```json
"publish": {
  "provider": "github",
  "releaseType": "release"
}
```

---

### 🔴 C4. No CI/CD Pipeline

**Impact:** Manual builds are error-prone. Every release requires:
1. Running `npm run build:electron` locally
2. Creating a GitHub release manually
3. Uploading artifacts
4. Forgetting `latest.yml` breaks the updater

**Fix:** Create `.github/workflows/release.yml` that:
- Triggers on version tags (`v*`)
- Builds on both `windows-latest` and `macos-latest`
- Signs with secrets
- Creates GitHub release with all artifacts

---

## 4. macOS-Specific Gaps

### 🔴 M1. No macOS Target in electron-builder.json

**Current state:** Only `win: { target: ["nsis"] }` is configured.

**Fix:** Add macOS target:
```json
"mac": {
  "target": ["dmg", "zip"],
  "category": "public.app-category.productivity",
  "icon": "build/icon.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.plist",
  "entitlementsInherit": "build/entitlements.inherit.plist"
}
```

---

### 🔴 M2. No macOS Code Signing

macOS requires code signing for:
- **Installation** — unsigned apps show "cannot be opened because the developer cannot be verified"
- **Notarization** — Apple must approve the app or Gatekeeper blocks it
- **Auto-updates** — electron-updater requires signed binaries to verify integrity

**Requirements:**
- Apple Developer account ($99/year)
- Create a **Developer ID Application** certificate
- Use `electron-osx-sign` (built into electron-builder) for signing

---

### 🔴 M3. No macOS Notarization

Since macOS 10.15 (Catalina), Apple requires **notarization** — an automated scan of the binary on Apple's servers. Without it:
- App shows "Apple cannot check it for malicious software"
- Updates silently fail on first launch

**Fix:** Add `scripts/notarize.js`:
```js
const { notarize } = require('@electron/notarize');

module.exports = async function(context) {
  if (context.platformName !== 'mac') return;
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('[notarize] Skipping — no Apple credentials');
    return;
  }
  await notarize({
    appBundleId: 'com.attrack.desktop',
    appPath: `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID,
  });
};
```

Add to `electron-builder.json`:
```json
"afterSign": "scripts/notarize.js"
```

---

### 🟡 M4. No macOS Entitlements

macOS sandbox requires explicit permissions. Without entitlements, the app may:
- Fail to access network (needed for AI providers)
- Fail to read/write user files
- Be rejected from notarization

**Fix:** Create `build/entitlements.plist`:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.debugger</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
</dict>
</plist>
```

---

### 🟡 M5. No macOS Icon

macOS requires a `.icns` file (icon set with multiple resolutions).

**Fix:** Create `build/icon.icns` — a 1024x1024 source PNG converted to `.icns` using `iconutil` (macOS only) or provided pre-built.

---

## 5. Folder Structure & Organization Audit

### Current State (Scattered)

```
atTrack/
├── electron/                  # Electron main process ✅
│   ├── main.js
│   ├── preload.js
│   ├── preload-setup.js
│   ├── server.js
│   ├── settings.js
│   └── setup.html
├── scripts/                   # Build scripts ✅ (but incomplete)
│   ├── electron-after-pack.js
│   ├── prepare-electron-build.js
│   └── generate-extension-icons.js
├── electron-builder.json      # Config ❌ (needs rewrite)
├── package.json               # Scripts ✅
└── (NO build/ folder)         # ❌ Missing entirely
```

### Recommended State (Organized)

```
atTrack/
├── electron/                          # Electron main process
│   ├── main.js
│   ├── preload.js
│   ├── preload-setup.js
│   ├── server.js
│   ├── settings.js
│   └── setup.html
├── build/                             # Build assets (NEW — organized)
│   ├── icons/
│   │   ├── windows.ico               # Windows icon (256x256)
│   │   ├── mac.icns                  # macOS icon (1024x1024)
│   │   └── linux.png                 # Linux icon (512x512)
│   ├── entitlements/
│   │   ├── entitlements.plist        # macOS main entitlements
│   │   └── entitlements.inherit.plist # macOS inherited entitlements
│   └── installer/
│       ├── nsis-header.bmp           # Windows installer header (optional)
│       └── nsis-wizard.bmp           # Windows installer wizard (optional)
├── scripts/                           # Build & release scripts
│   ├── electron-after-pack.js        # Post-pack hook
│   ├── prepare-electron-build.js     # Pre-pack preparation
│   ├── generate-extension-icons.js   # Extension icon generator
│   ├── notarize.js                   # macOS notarization (NEW)
│   └── sign.js                       # Windows signing (NEW)
├── .github/
│   └── workflows/
│       └── release.yml               # CI/CD release workflow (NEW)
├── electron-builder.json              # Build config (REWRITTEN)
└── package.json                       # Scripts & dependencies (UPDATED)
```

---

## 6. Complete Remediation Roadmap

### Phase 1: Critical Fixes (Do First)

| # | Task | File | Effort |
|---|---|---|---|
| 1 | Fix output path | `electron-builder.json` | 1 min |
| 2 | Add `releaseType: "release"` | `electron-builder.json` | 1 min |
| 3 | Create `build/` folder structure | `build/` | 5 min |
| 4 | Add macOS entitlements | `build/entitlements/*.plist` | 10 min |
| 5 | Add macOS target to config | `electron-builder.json` | 5 min |
| 6 | Create notarization script | `scripts/notarize.js` | 15 min |
| 7 | Create signing script | `scripts/sign.js` | 15 min |
| 8 | Update package.json scripts | `package.json` | 5 min |
| 9 | Add @electron/notarize dependency | `package.json` | 1 min |

### Phase 2: CI/CD (Do Second)

| # | Task | File | Effort |
|---|---|---|---|
| 10 | Create GitHub Actions workflow | `.github/workflows/release.yml` | 30 min |
| 11 | Document release process | `docs/RELEASE.md` | 20 min |

### Phase 3: Assets & Polish (Do Third)

| # | Task | File | Effort |
|---|---|---|---|
| 12 | Create/obtain Windows icon | `build/icons/windows.ico` | Varies |
| 13 | Create/obtain macOS icon | `build/icons/mac.icns` | Varies |
| 14 | Test on clean Windows VM | — | 30 min |
| 15 | Test on clean macOS VM | — | 30 min |

---

## 7. Recommended Configuration

### 7.1 Rewritten `electron-builder.json`

```json
{
  "appId": "com.attrack.desktop",
  "productName": "AtTrack",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "electron/**/*",
    "package.json",
    "build/icons/**/*"
  ],
  "publish": {
    "provider": "github",
    "releaseType": "release"
  },
  "afterPack": "scripts/electron-after-pack.js",
  "afterSign": "scripts/notarize.js",
  "win": {
    "target": ["nsis"],
    "icon": "build/icons/windows.ico",
    "sign": "./scripts/sign.js",
    "signingHashAlgorithms": ["sha256"]
  },
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.productivity",
    "icon": "build/icons/mac.icns",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements/entitlements.plist",
    "entitlementsInherit": "build/entitlements/entitlements.inherit.plist"
  },
  "linux": {
    "target": ["AppImage", "deb"],
    "category": "Office",
    "icon": "build/icons/linux.png"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true,
    "artifactName": "AtTrack-Setup-${version}-win.exe"
  },
  "dmg": {
    "sign": false,
    "contents": [
      { "x": 130, "y": 220 },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ],
    "artifactName": "AtTrack-${version}-mac.dmg"
  }
}
```

### 7.2 Updated `package.json` Scripts

```json
{
  "scripts": {
    "dev": "next dev -p 3308",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "electron:dev": "next build && node scripts/prepare-electron-build.js && electron electron/main.js",
    "electron:build:win": "next build && node scripts/prepare-electron-build.js && electron-builder --win --publish never",
    "electron:build:mac": "next build && node scripts/prepare-electron-build.js && electron-builder --mac --publish never",
    "electron:build:all": "next build && node scripts/prepare-electron-build.js && electron-builder --win --mac --publish never",
    "electron:release": "next build && node scripts/prepare-electron-build.js && electron-builder --win --mac --publish always"
  }
}
```

---

## 8. CI/CD Pipeline Design

### `.github/workflows/release.yml`

```yaml
name: Build & Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    strategy:
      matrix:
        include:
          - os: windows-latest
            platform: win
          - os: macos-latest
            platform: mac

    runs-on: ${{ matrix.os }}

    env:
      GH_TOKEN: *** secrets.GITHUB_TOKEN }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'

      - run: npm ci

      # macOS: code signing + notarization
      - if: matrix.platform == 'mac'
        name: Import Apple Certificate
        uses: apple-actions/import-codesign-certs@v2
        with:
          p12-file-base64: ${{ secrets.MAC_CERTS }}
          p12-password: ${{ secrets.MAC_CERTS_PASSWORD }}

      - if: matrix.platform == 'mac'
        name: Set Apple Notarization Credentials
        run: |
          echo "APPLE_ID=${{ secrets.APPLE_ID }}" >> $GITHUB_ENV
          echo "APPLE_APP_SPECIFIC_PASSWORD=${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}" >> $GITHUB_ENV
          echo "APPLE_TEAM_ID=${{ secrets.APPLE_TEAM_ID }}" >> $GITHUB_ENV

      # Windows: code signing
      - if: matrix.platform == 'win'
        name: Set Windows Signing Certificate
        run: |
          echo "CSC_LINK=${{ secrets.WIN_CSC_LINK }}" >> $GITHUB_ENV
          echo "CSC_KEY_PASSWORD=${{ secrets.WIN_CSC_KEY_PASSWORD }}" >> $GITHUB_ENV

      - name: Build & Publish
        run: |
          npm run build
          npx electron-builder --${{ matrix.platform }} --publish always
```

### Required GitHub Secrets

| Secret | Platform | Description |
|---|---|---|
| `MAC_CERTS` | macOS | Base64-encoded `.p12` Developer ID certificate |
| `MAC_CERTS_PASSWORD` | macOS | Password for the `.p12` file |
| `APPLE_ID` | macOS | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App-specific password (from appleid.apple.com) |
| `APPLE_TEAM_ID` | macOS | 10-character team ID |
| `WIN_CSC_LINK` | Windows | Base64-encoded `.pfx` certificate or Azure Key Vault URL |
| `WIN_CSC_KEY_PASSWORD` | Windows | Certificate password |

---

## Summary

The auto-update **logic** is correct. The **infrastructure** is missing:

1. ❌ No Windows signing → SmartScreen blocks users
2. ❌ No macOS support at all → only Windows builds possible
3. ❌ Hardcoded paths → build fails on CI/CD
4. ❌ Missing `releaseType` → updates are invisible drafts
5. ❌ No organized `build/` folder → assets scattered
6. ❌ No CI/CD → manual release process

After implementing this report, the flow will be:

```
You push a tag v1.6.0
    → GitHub Actions builds on Windows + macOS
    → Both binaries signed + macOS notarized
    → GitHub Release created with all artifacts + latest.yml
    → Users' apps detect update → auto-download → restart to apply
    → No re-installation needed
```

**Estimated implementation time:** 2-3 hours (excluding certificate procurement).
