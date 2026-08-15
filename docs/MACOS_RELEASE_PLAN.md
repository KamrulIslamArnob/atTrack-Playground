# atTrack — macOS Release Plan

> **Target:** Full macOS desktop release with seamless auto-updates
> **Platform:** macOS 13+ (Ventura and later)
> **Architecture:** Universal binary (Apple Silicon + Intel)

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Folder Structure for macOS Assets](#2-folder-structure-for-mac-os-assets)
3. [Step-by-Step Implementation](#3-step-by-step-implementation)
4. [Code Signing & Notarization](#4-code-signing--notarization)
5. [Auto-Update on macOS](#5-auto-update-on-macos)
6. [DMG Installer Design](#6-dmg-installer-design)
7. [Testing Checklist](#7-testing-checkling-checklist)
8. [Troubleshooting Guide](#8-troubleshooting-guide)

---

## 1. Prerequisites

### 1.1 Apple Developer Account
- **Cost:** $99/year
- **Enrollment:** [developer.apple.com](https://developer.apple.com)
- **Required for:**
  - Code signing certificates
  - Notarization
  - App Store distribution (optional, not needed for direct distribution)

### 1.2 Certificates to Create

| Certificate | Purpose | Where to Create |
|---|---|---|
| **Developer ID Application** | Sign the macOS app for distribution outside the App Store | Apple Developer → Certificates → Production |
| **Developer ID Installer** | Sign the DMG installer | Apple Developer → Certificates → Production |
| **Mac App Distribution** | (Optional) If distributing via App Store | Apple Developer → Certificates → Production |

> **Important:** You need **Developer ID Application** specifically. The "Mac Development" certificate only works on machines with your development provisioning profile installed. For distributing to users, **Developer ID** is mandatory.

### 1.3 App-Specific Password
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **App-Specific Passwords**
4. Generate a new password (name it "atTrack Notarization")
5. Save the password securely — you'll use it in CI/CD

### 1.4 Team ID
1. Go to [developer.apple.com](https://developer.apple.com)
2. Navigate to **Membership**
3. Your **Team ID** is a 10-character string (e.g., `AB1C2D3E4F`)
4. Save this for notarization scripts

---

## 2. Folder Structure for macOS Assets

```
atTrack/
├── build/
│   ├── icons/
│   │   ├── mac.icns              # macOS app icon (1024x1024 source)
│   │   ├── windows.ico           # Windows app icon (256x256)
│   │   └── linux.png             # Linux app icon (512x512)
│   ├── entitlements/
│   │   ├── entitlements.plist    # Main app entitlements
│   │   └── entitlements.inherit.plist  # Inherited entitlements
│   └── installer/
│       ├── dmg-background.png    # DMG background image (optional)
│       └── dmg-icon.icns         # DMG volume icon (optional)
├── scripts/
│   └── notarize.js               # macOS notarization script
├── electron-builder.json         # Updated with macOS config
└── package.json                  # Updated scripts
```

---

## 3. Step-by-Step Implementation

### Step 1: Create `build/icons/mac.icns`

**Option A: Generate on macOS (Recommended)**
1. Create a 1024x1024 PNG icon (with transparency)
2. On macOS, create an `iconset` folder:
```bash
mkdir MyApp.iconset
sips -z 16 16     icon.png --out MyApp.iconset/icon_16x16.png
sips -z 32 32     icon.png --out MyApp.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out MyApp.iconset/icon_32x32.png
sips -z 64 64     icon.png --out MyApp.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out MyApp.iconset/icon_128x128.png
sips -z 256 256   icon.png --out MyApp.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out MyApp.iconset/icon_256x256.png
sips -z 512 512   icon.png --out MyApp.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out MyApp.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out MyApp.iconset/icon_512x512@2x.png
iconutil -c icns MyApp.iconset -o build/icons/mac.icns
rm -rf MyApp.iconset
```

**Option B: Use a pre-built `.icns`**
- Source one from a design tool (Figma, Sketch)
- Or use `png2icns` on Linux/Windows (limited quality)

---

### Step 2: Create Entitlements Files

**`build/entitlements/entitlements.plist`** — Main app entitlements:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <!-- Required for Node.js / V8 JIT compilation -->
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.debugger</key>
  <true/>

  <!-- Network access (required for AI providers) -->
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>

  <!-- File access (user-selected files) -->
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>

  <!-- No sandbox — required for Electron apps -->
  <!-- Electron apps typically run outside the sandbox -->
</dict>
</plist>
```

**`build/entitlements/entitlements.inherit.plist`** — For child processes:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
</dict>
</plist>
```

---

### Step 3: Create Notarization Script

**`scripts/notarize.js`**:
```javascript
const { notarize } = require('@electron/notarize');

module.exports = async function(context) {
  // Only notarize macOS builds
  if (context.platformName !== 'mac') {
    console.log('[notarize] Skipping — not macOS');
    return;
  }

  // Skip if no credentials (e.g., local dev build)
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('[notarize] Skipping — no Apple credentials in environment');
    return;
  }

  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appName}...`);

  try {
    await notarize({
      appBundleId: 'com.attrack.desktop',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
      tool: 'notarytool',  // Use the modern notarytool (Xcode 13+)
    });
    console.log('[notarize] Notarization complete!');
  } catch (error) {
    console.error('[notarize] Notarization failed:', error);
    // Don't throw — let the build continue but warn the user
    console.warn('[notarize] Build will continue but app may be blocked by Gatekeeper');
  }
};
```

---

### Step 4: Update `electron-builder.json`

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
    "target": [
      {
        "target": "dmg",
        "arch": ["universal"]
      },
      {
        "target": "zip",
        "arch": ["universal"]
      }
    ],
    "category": "public.app-category.productivity",
    "icon": "build/icons/mac.icns",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements/entitlements.plist",
    "entitlementsInherit": "build/entitlements/entitlements.inherit.plist",
    "minimumSystemVersion": "13.0"
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
      { "x": 130, "y": 220, "type": "file" },
      { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
    ],
    "window": {
      "width": 540,
      "height": 380
    },
    "artifactName": "AtTrack-${version}-mac.dmg"
  }
}
```

**Key macOS settings explained:**
- `target: "dmg"` — DMG installer (drag-to-Applications)
- `target: "zip"` — ZIP fallback (required for electron-updater to work)
- `arch: ["universal"]` — Single binary runs on both Apple Silicon and Intel
- `hardenedRuntime: true` — Required for notarization
- `gatekeeperAssess: false` — We handle notarization ourselves
- `sign: false` for DMG — DMG signing is optional; app signing is what matters

---

### Step 5: Update `package.json`

Add the `@electron/notarize` dependency:
```bash
npm install --save-dev @electron/notarize
```

Update scripts:
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

### Step 6: Import Certificate on macOS Build Machine

**For local builds:**
1. Download the `.p12` file from Apple Developer
2. Double-click to add it to Keychain Access
3. electron-builder will find it automatically

**For CI/CD (GitHub Actions):**
```yaml
- name: Import Apple Certificate
  uses: apple-actions/import-codesign-certs@v2
  with:
    p12-file-base64: ${{ secrets.MAC_CERTS }}
    p12-password: ${{ secrets.MAC_CERTS_PASSWORD }}
```

You need to export your certificate as `.p12` and encode it:
```bash
base64 -i Certificate.p12 -o encoded.txt
# Paste contents of encoded.txt into GitHub Secret "MAC_CERTS"
```

---

## 4. Code Signing & Notarization

### 4.1 Signing Flow

```
electron-builder builds app
    ↓
electron-osx-sign signs the .app bundle
    ↓
  - Signs all native modules (sqlite-vec, sharp)
   - Signs the main app binary
   - Embeds the entitlements
    ↓
electron-builder packages DMG
    ↓
afterSign hook runs notarize.js
    ↓
@electron/notarize uploads to Apple
    ↓
Apple scans binary (5-15 minutes)
    ↓
Stapler attaches ticket to the app
    ↓
App can run on any Mac (Gatekeeper approved)
```

### 4.2 Notarization Timing

- **First submission:** 10-30 minutes
- **Subsequent submissions:** 3-5 minutes
- **CI/CD builds:** Add a delay or use `waitForCDP` option

### 4.3 Troubleshooting Notarization

| Error | Cause | Fix |
|---|---|---|
| `Invalid` status from Apple | Binary issue | Check Apple's notarization log |
| `API key missing` | No credentials | Set `APPLE_ID` env var |
| `Team not found` | Wrong team ID | Verify `APPLE_TEAM_ID` |
| `Hardened runtime disabled` | Config issue | Set `hardenedRuntime: true` |

---

## 5. Auto-Update on macOS

### 5.1 How electron-updater Works on macOS

1. App checks GitHub Releases for `latest-mac.yml`
2. If newer version exists → downloads `.zip` (not `.dmg`)
3. Extracts the `.app` bundle
4. Replaces the running app
5. Restarts with the new version

> **Important:** On macOS, electron-updater uses the **ZIP** artifact, not the DMG. The DMG is only for initial installation.

### 5.2 Update Flow

```
User opens atTrack
    ↓
electron/main.js:277 — 5s after launch
    ↓
autoUpdater.checkForUpdatesAndNotify()
    ↓
GET https://api.github.com/repos/KamrulIslamArnob/atTrack/releases/latest
    ↓
Reads latest-mac.yml:
  version: 1.6.0
  path: atTrack-1.6.0-mac.zip
  sha512: abc123...
    ↓
Downloads zip to /Users/<user>/Library/Application Support/atTrack-updater/
    ↓
Verifies SHA512 hash
    ↓
Extracts .app bundle
    ↓
Emits "update-downloaded"
    ↓
UI shows "Restart & Install"
    ↓
User clicks → quitAndInstall()
    ↓
App relaunches with new version ✅
```

### 5.3 Testing Updates Locally

```bash
# 1. Build v1.5.0 (current)
npm run electron:build:mac

# 2. Install and launch it

# 3. Bump version to v1.6.0 in package.json

# 4. Build v1.6.0 with --publish never
npm run electron:build:mac

# 5. Start a local static server
cd release/mac
python3 -m http.server 8080

# 6. The app should detect the update and download it
```

---

## 6. DMG Installer Design

### 6.1 DMG Contents

```
AtTrack Installer.dmg
├── AtTrack.app          # The app bundle
├── Applications         # Alias to /Applications
└── .background.png      # Custom background image
```

### 6.2 User Experience

1. User downloads `AtTrack-1.6.0-mac.dmg`
2. Double-clicks to mount the DMG
3. DMG opens with a background image showing "Drag AtTrack to Applications"
4. User drags `AtTrack.app` to the `Applications` alias
5. DMG auto-ejects
6. App launches from `/Applications/AtTrack.app`

### 6.3 DMG Background (Optional)

Create `build/installer/dmg-background.png`:
- Size: 540x380 pixels
- Show app icon + "Drag to Applications" text
- Keep it simple and clean

Update `electron-builder.json`:
```json
"dmg": {
  "background": "build/installer/dmg-background.png",
  "contents": [
    { "x": 130, "y": 220, "type": "file" },
    { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
  ],
  "window": {
    "width": 540,
    "height": 380
  }
}
```

---

## 7. Testing Checklist

### 7.1 Local macOS Build Test

- [ ] `npm run electron:build:mac` succeeds
- [ ] `.app` bundle is created in `release/mac/`
- [ ] DMG is created in `release/`
- [ ] ZIP is created in `release/` (required for updates)

### 7.2 Installation Test (Clean Mac)

- [ ] DMG mounts without errors
- [ ] App launches from DMG
- [ ] App launches after dragging to Applications
- [ ] No "Apple cannot check it for malicious software" warning
- [ ] App icon appears correctly in Dock

### 7.3 Gatekeeper Verification

```bash
# Check code signing
codesign -dv --verbose=4 /Applications/AtTrack.app

# Check notarization
spctl -a -vv /Applications/AtTrack.app

# Should show: "accepted" and source="Developer ID"
```

### 7.4 Auto-Update Test

- [ ] Install v1.5.0
- [ ] Create v1.6.0 release on GitHub
- [ ] Open v1.5.0 → update notification appears
- [ ] Update downloads and installs
- [ ] App restarts with v1.6.0

### 7.5 Clean Install Test (Fresh User)

```bash
# Simulate a fresh user
rm -rf ~/Library/Application\ Support/atTrack
rm -rf ~/Library/Preferences/com.attrack.desktop.plist
rm -rf ~/Library/Caches/atTrack
rm -rf /Applications/AtTrack.app

# Install from DMG
# Should work without any prior setup
```

---

## 8. Troubleshooting Guide

### Problem: "App is damaged and can't be opened"

**Cause:** App was quarantined by Gatekeeper (common when downloading from internet).

**Fix:**
```bash
xattr -cr /Applications/AtTrack.app
```

Or the user can:
1. Right-click the app → Open
2. Click "Open" in the dialog

### Problem: Auto-update downloads but fails to install

**Cause:** Code signature mismatch or notarization issue.

**Fix:**
```bash
# Check the update log
cat ~/Library/Application\ Support/atTrack-updater/logs/main.log
```

### Problem: "App can't be opened because the developer cannot be verified"

**Cause:** App is not notarized or signed with a Developer ID certificate.

**Fix:**
1. Ensure `afterSign` hook runs `notarize.js`
2. Check that `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID` are set
3. Verify the certificate is a **Developer ID** certificate, not "Mac Development"

### Problem: Universal binary doesn't work on Intel Mac

**Cause:** Native modules (sqlite-vec, sharp) compiled only for Apple Silicon.

**Fix:**
```bash
# Rebuild native modules for both architectures
npm rebuild --arch=universal

# Or build separate builds per architecture and merge with lipo
```

---

## Summary

| Task | Status | File |
|---|---|---|
| Create macOS icon (.icns) | ⬜ To do | `build/icons/mac.icns` |
| Create entitlements | ⬜ To do | `build/entitlements/*.plist` |
| Create notarize script | ⬜ To do | `scripts/notarize.js` |
| Update electron-builder.json | ⬜ To do | `electron-builder.json` |
| Update package.json | ⬜ To do | `package.json` |
| Add @electron/notarize | ⬜ To do | `npm install` |
| Configure GitHub Secrets | ⬜ To do | GitHub repo settings |
| Test on macOS | ⬜ To do | macOS machine |
| First release | ⬜ To do | `npm run electron:release` |

**Estimated time:** 3-4 hours (excluding Apple Developer account setup which takes 1-2 days for enrollment).

**Cost:** $99/year for Apple Developer account.
