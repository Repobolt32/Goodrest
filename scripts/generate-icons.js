const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

fs.copyFileSync(
  path.join(root, 'public', 'icons', 'icon-512x512.png'),
  path.join(root, 'electron', 'assets', 'icon.png')
);

fs.copyFileSync(
  path.join(root, 'public', 'icons', 'icon-192x192.png'),
  path.join(root, 'electron', 'assets', 'tray-icon.png')
);

console.log('Icons copied to electron/assets/');
