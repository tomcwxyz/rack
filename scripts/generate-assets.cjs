const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const iconSource = path.join(root, 'apps/desktop/src-tauri/icons/icon.png.b64');
const iconDestination = path.join(root, 'apps/desktop/src-tauri/icons/icon.png');

if (fs.existsSync(iconSource) && !fs.existsSync(iconDestination)) {
  fs.writeFileSync(
    iconDestination,
    Buffer.from(fs.readFileSync(iconSource, 'utf8').trim(), 'base64'),
  );
}
