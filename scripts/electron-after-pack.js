// electron-builder's `extraResources` silently drops node_modules when copying a
// directory (confirmed empirically, with and without an explicit filter) — so instead
// of fighting its copy semantics, we do the standalone-build copy ourselves here,
// after packaging, with the same fs.cpSync used by prepare-electron-build.js.
const { cpSync, existsSync } = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  const standaloneSrc = path.join(context.packager.projectDir, ".next", "standalone");
  const standaloneDest = path.join(context.appOutDir, "resources", "standalone");
  if (existsSync(standaloneSrc)) {
    cpSync(standaloneSrc, standaloneDest, { recursive: true });
    console.log(`[afterPack] copied .next/standalone -> ${standaloneDest}`);
  } else {
    console.warn(`[afterPack] Warning: ${standaloneSrc} does not exist`);
  }
};
