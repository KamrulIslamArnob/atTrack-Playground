const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function main() {
  const extIconsDir = path.resolve(__dirname, '../extension/icons');
  const darkSvg = path.join(extIconsDir, 'icon-256-dark.svg');

  for (const size of [16, 48, 128, 256]) {
    await sharp(darkSvg)
      .resize(size, size)
      .png()
      .toFile(path.join(extIconsDir, 'icon-' + size + '.png'));
    console.log('Generated icon-' + size + '.png from icon-256-dark.svg (no background)');
  }
}
main().catch(err => { console.error(err); process.exit(1); });
