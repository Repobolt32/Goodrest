const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const standaloneSrc = path.join(root, '.next', 'standalone');
const standaloneDst = path.join(root, 'electron', '.next', 'standalone');
const staticSrc = path.join(root, '.next', 'static');
const staticDst = path.join(standaloneDst, '.next', 'static');
const publicSrc = path.join(root, 'public');
const publicDst = path.join(standaloneDst, 'public');

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (fs.existsSync(standaloneDst)) {
  fs.rmSync(standaloneDst, { recursive: true, force: true });
}

console.log('Copying standalone server...');
copyDirSync(standaloneSrc, standaloneDst);

console.log('Copying static assets...');
copyDirSync(staticSrc, staticDst);

console.log('Copying public assets...');
copyDirSync(publicSrc, publicDst);

console.log('Done. Standalone server ready at electron/.next/standalone/');
