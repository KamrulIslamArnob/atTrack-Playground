// Generates build/icons/{windows.ico,mac.icns,linux.png} from public/icon-256.svg.
//
// No macOS machine available to run `iconutil`, so this writes the .icns
// container by hand instead: since macOS 10.7 every ic* chunk in an .icns
// file accepts a plain PNG blob directly (iconutil does the same thing for
// PNG-sourced iconsets — it does not re-encode), so this produces the same
// bytes iconutil would for these inputs. Re-run after the source SVG changes:
//   node scripts/generate-desktop-icons.js
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const SOURCE = path.join(__dirname, "..", "public", "icon-256.svg");
const OUT_DIR = path.join(__dirname, "..", "build", "icons");

async function renderPng(size) {
  return sharp(SOURCE, { density: 384 }).resize(size, size).png().toBuffer();
}

// --- .ico (Windows): ICONDIR + ICONDIRENTRY[] + embedded PNGs (Vista+) ---
async function buildIco(sizes) {
  const images = await Promise.all(sizes.map(renderPng));
  const dirHeader = Buffer.alloc(6);
  dirHeader.writeUInt16LE(0, 0); // reserved
  dirHeader.writeUInt16LE(1, 2); // type: icon
  dirHeader.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = [];
  for (let i = 0; i < sizes.length; i++) {
    const size = sizes[i];
    const png = images[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 means 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  }
  return Buffer.concat([dirHeader, ...entries, ...images]);
}

// --- .icns (macOS): "icns" + totalLen(BE) + repeated [OSType(4) + len(BE,4) + PNG] ---
const ICNS_ENTRIES = [
  ["icp4", 16],
  ["icp5", 32],
  ["ic11", 32], // 16pt @2x
  ["ic12", 64], // 32pt @2x
  ["ic07", 128],
  ["ic13", 256], // 128pt @2x
  ["ic08", 256],
  ["ic14", 512], // 256pt @2x
  ["ic09", 512],
  ["ic10", 1024], // 512pt @2x
];

async function buildIcns() {
  const uniqueSizes = [...new Set(ICNS_ENTRIES.map(([, s]) => s))];
  const pngBySize = new Map(await Promise.all(uniqueSizes.map(async (s) => [s, await renderPng(s)])));

  const chunks = ICNS_ENTRIES.map(([type, size]) => {
    const png = pngBySize.get(size);
    const chunk = Buffer.alloc(8 + png.length);
    chunk.write(type, 0, "ascii");
    chunk.writeUInt32BE(8 + png.length, 4);
    png.copy(chunk, 8);
    return chunk;
  });

  const body = Buffer.concat(chunks);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(8 + body.length, 4);
  return Buffer.concat([header, body]);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const ico = await buildIco([16, 32, 48, 64, 128, 256]);
  fs.writeFileSync(path.join(OUT_DIR, "windows.ico"), ico);
  console.log(`[icons] wrote build/icons/windows.ico (${ico.length} bytes)`);

  const icns = await buildIcns();
  fs.writeFileSync(path.join(OUT_DIR, "mac.icns"), icns);
  console.log(`[icons] wrote build/icons/mac.icns (${icns.length} bytes)`);

  const linuxPng = await renderPng(512);
  fs.writeFileSync(path.join(OUT_DIR, "linux.png"), linuxPng);
  console.log(`[icons] wrote build/icons/linux.png (${linuxPng.length} bytes)`);
}

main().catch((err) => {
  console.error("[icons] failed:", err);
  process.exit(1);
});
