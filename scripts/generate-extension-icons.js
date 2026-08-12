const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

async function generateIcons() {
  const iconsDir = path.join(__dirname, "..", "extension", "icons");
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [16, 48, 128];

  for (const size of sizes) {
    // Create an elegant gradient briefcase SVG icon
    const svg = `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#3b82f6"/>
            <stop offset="100%" stop-color="#6366f1"/>
          </linearGradient>
        </defs>
        <rect width="100" height="100" rx="20" fill="url(#bgGrad)"/>
        <!-- Briefcase Icon -->
        <rect x="20" y="36" width="60" height="42" rx="8" fill="none" stroke="#ffffff" stroke-width="6"/>
        <path d="M36 36 V 26 A 6 6 0 0 1 42 20 H 58 A 6 6 0 0 1 64 26 V 36" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
        <line x1="20" y1="52" x2="80" y2="52" stroke="#ffffff" stroke-width="4" stroke-opacity="0.6"/>
        <circle cx="50" cy="52" r="5" fill="#ffffff"/>
      </svg>
    `;

    const outputPath = path.join(iconsDir, `icon-${size}.png`);
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated ${outputPath} (${size}x${size})`);
  }
}

generateIcons().catch(err => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
