const fs = require('fs');
const path = require('path');

const uiDir = path.join(process.cwd(), 'components', 'ui');
const files = fs.readdirSync(uiDir).filter(f => f.endsWith('.tsx'));

for (const f of files) {
  const fullPath = path.join(uiDir, f);
  let content = fs.readFileSync(fullPath, 'utf8');

  // Change size?: number to size?: number | string
  content = content.replace(/size\?:\s*number;/g, 'size?: number | string;');

  // Fix duplicate className on svg
  content = content.replace(
    /className="size-full"\s+className="overflow-visible"/g,
    'className="size-full overflow-visible"'
  );

  fs.writeFileSync(fullPath, content, 'utf8');
}

console.log('Fixed icon prop types & SVG classNames in components/ui');
