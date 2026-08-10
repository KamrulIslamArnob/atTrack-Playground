// Next's `output: "standalone"` traces server code + node_modules but deliberately
// does not copy public/ or .next/static/ (documented Next behavior, not a bug) —
// both are required for the standalone server to serve the app correctly. Run this
// after every `next build` and before starting/packaging the standalone server.
const { cpSync } = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");

cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), {
  recursive: true,
});
cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true });

console.log("Copied .next/static and public/ into .next/standalone");
