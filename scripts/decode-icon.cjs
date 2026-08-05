const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'apps/desktop/src-tauri/icons/icon.png.b64');
const destination = path.join(root, 'apps/desktop/src-tauri/icons/icon.png');

fs.writeFileSync(destination, Buffer.from(fs.readFileSync(source, 'utf8').trim(), 'base64'));
