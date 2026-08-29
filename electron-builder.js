// electron-builder config (JS, not JSON) specifically so `electronDist` below
// can be a function — see the comment on that field for why.
const path = require("node:path");

module.exports = {
  appId: "com.betterjob.desktop",
  productName: "BetterJob",
  directories: {
    output: "release",
    buildResources: "build",
  },
  files: ["electron/**/*", "package.json", "build/icons/**/*"],
  // Update feed. The repo is private, and electron-updater cannot read a
  // private repo's GitHub Releases without a token shipped inside the app —
  // anyone who installed it could extract that token and read the whole repo.
  // So the installer and its update metadata go to a public Cloudflare R2
  // bucket and the app checks there instead: the repo stays private and no
  // credential is ever bundled.
  //
  // `generic` is a download-only provider. electron-builder writes an
  // app-update.yml pointing at this URL but cannot upload to it, so CI builds
  // with `--publish never` and uploads the artifacts to R2 explicitly over R2's
  // S3-compatible API (see .github/workflows/release.yml). The credentials for
  // that upload live only in GitHub Actions secrets, never in the app.
  //
  // UPDATE_FEED_URL overrides this so a staging bucket can be pointed at
  // without editing the config.
  publish: {
    provider: "generic",
    url:
      process.env.UPDATE_FEED_URL ||
      "https://pub-f7779030e419465497d9f0d556d7aac4.r2.dev",
  },
  // Windows-only fix for a well-documented electron-builder/Windows bug:
  // by default electron-builder re-downloads the Electron distribution zip
  // into release/win-unpacked.tmp and extracts it with up to 8 files writing
  // concurrently (builder-util's MAX_FILE_REQUESTS), then immediately deletes
  // resources/default_app.asar in the same breath. On Windows, a filter
  // driver (AV real-time scan, but also observed with none registered) can
  // still be holding a just-closed handle on that exact file for a few
  // milliseconds, so the delete-then-recreate step throws
  // "EBUSY: resource busy or locked, unlink ... default_app.asar" — this is
  // a race inside electron-builder's own extraction step (app-builder-lib's
  // ElectronFramework.js), not something this codebase's build scripts do;
  // `scripts/electron-after-pack.js` and `scripts/prepare-electron-build.js`
  // never touch this path or run until packaging is already complete.
  //
  // `node_modules/electron/dist` is already a fully-extracted distribution
  // for the CURRENT host platform (npm's postinstall for the `electron`
  // devDependency downloads and unpacks it, since `electron:dev` runs it
  // directly). Pointing electronDist at that existing directory makes
  // electron-builder take its "already unpacked" branch instead: a plain
  // recursive `copyDir` with no concurrent zip extraction and no
  // delete-then-recreate step, which sidesteps the race entirely (and
  // skips a redundant second download+extract of the same zip).
  //
  // This must be a function, not a plain string, so it can check the
  // platform actually being packaged: node_modules/electron/dist only ever
  // holds a build for the CURRENT host OS, so this only applies when
  // packaging Windows from a Windows host — a mac/linux target (e.g. via
  // `electron:build:all` on this machine) still falls through to the
  // normal per-target zip download by returning null.
  electronDist: (prepareOptions) => {
    if (process.platform === "win32" && prepareOptions.platformName === "win32") {
      return path.join(__dirname, "node_modules", "electron", "dist");
    }
    return null;
  },
  afterPack: "scripts/electron-after-pack.js",
  afterSign: "scripts/notarize.js",
  win: {
    target: ["nsis"],
    icon: "build/icons/windows.ico",
    executableName: "BetterJob",
    signtoolOptions: {
      sign: "./scripts/sign.js",
      signingHashAlgorithms: ["sha256"],
    },
  },
  mac: {
    target: [
      { target: "dmg", arch: ["universal"] },
      { target: "zip", arch: ["universal"] },
    ],
    category: "public.app-category.productivity",
    icon: "build/icons/mac.icns",
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "build/entitlements/entitlements.plist",
    entitlementsInherit: "build/entitlements/entitlements.inherit.plist",
    minimumSystemVersion: "13.0",
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Office",
    icon: "build/icons/linux.png",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    artifactName: "BetterJob-Setup-${version}-win.exe",
    include: "build/installer.nsh",
  },
  dmg: {
    sign: false,
    contents: [
      { x: 130, y: 220, type: "file" },
      { x: 410, y: 220, type: "link", path: "/Applications" },
    ],
    window: {
      width: 540,
      height: 380,
    },
    artifactName: "BetterJob-${version}-mac.dmg",
  },
};
