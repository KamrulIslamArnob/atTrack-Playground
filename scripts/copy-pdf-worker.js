// atTrack runs offline. Loading the pdf.js worker from a CDN meant that opening a
// resume or extracting text from an uploaded PDF failed on any machine without a
// live internet connection — which is most of the time, for a desktop app people
// install and use on a plane, on a train, or behind a corporate proxy.
//
// Copying the worker out of node_modules on every install keeps it byte-identical
// to the pdfjs-dist version actually resolved, so bumping the dependency can never
// leave a stale worker behind. public/ is already copied into the Electron
// standalone tree by prepare-electron-build.js, so this covers both dev and the
// packaged app with no extra wiring.
const { copyFileSync, mkdirSync } = require("node:fs");
const path = require("node:path");

const WORKER = "pdf.worker.min.mjs";

const src = require.resolve(`pdfjs-dist/build/${WORKER}`);
const destDir = path.join(__dirname, "..", "public");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, path.join(destDir, WORKER));

const { version } = require("pdfjs-dist/package.json");
console.log(`Copied pdfjs-dist@${version} ${WORKER} into public/`);
