const { cpSync, existsSync, rmSync } = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  const standaloneSrc = path.join(context.packager.projectDir, ".next", "standalone");
  const standaloneDest = path.join(context.appOutDir, "resources", "standalone");
  if (existsSync(standaloneSrc)) {
    cpSync(standaloneSrc, standaloneDest, { recursive: true, force: true, dereference: true });
    console.log(`[afterPack] Copied .next/standalone (including node_modules) -> ${standaloneDest}`);
  } else {
    console.warn(`[afterPack] Warning: ${standaloneSrc} does not exist`);
  }

  // electron-builder.js's `electronDist` hook (Windows only — see the comment
  // there) makes electron-builder treat node_modules/electron/dist as an
  // already-unpacked, custom Electron distribution. It deliberately skips its
  // usual post-extraction cleanup for that path ("respect its contents as
  // required"), which normally removes Electron's own placeholder app and
  // version stamp. Neither breaks anything left in place (our app.asar/
  // resources always take priority at runtime), but they're dead weight in
  // the installer, so remove them ourselves once packaging is done and there
  // is no extraction race left to lose — this is a plain unlink of a file
  // nothing else is writing to at this point in the pipeline.
  if (context.electronPlatformName === "win32") {
    for (const relPath of [path.join("resources", "default_app.asar"), "version"]) {
      const target = path.join(context.appOutDir, relPath);
      if (existsSync(target)) {
        try {
          rmSync(target, { force: true });
          console.log(`[afterPack] Removed unused Electron default-dist file: ${relPath}`);
        } catch (err) {
          console.warn(`[afterPack] Could not remove ${relPath} (non-fatal): ${err.message}`);
        }
      }
    }
  }
};
