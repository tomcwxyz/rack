const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const iconDirectory = path.join(root, 'apps/desktop/src-tauri/icons');
const pngSource = path.join(iconDirectory, 'icon.png.b64');
const pngDestination = path.join(iconDirectory, 'icon.png');
const icoDestination = path.join(iconDirectory, 'icon.ico');

if (fs.existsSync(pngSource) && !fs.existsSync(pngDestination)) {
  fs.writeFileSync(
    pngDestination,
    Buffer.from(fs.readFileSync(pngSource, 'utf8').trim(), 'base64'),
  );
}

const createPlaceholderIco = () => {
  const width = 32;
  const height = 32;
  const pixelBytes = width * height * 4;
  const maskStride = Math.ceil(width / 32) * 4;
  const maskBytes = maskStride * height;
  const imageBytes = 40 + pixelBytes + maskBytes;
  const imageOffset = 6 + 16;

  const output = Buffer.alloc(imageOffset + imageBytes);

  // ICONDIR
  output.writeUInt16LE(0, 0);
  output.writeUInt16LE(1, 2);
  output.writeUInt16LE(1, 4);

  // ICONDIRENTRY
  output.writeUInt8(width, 6);
  output.writeUInt8(height, 7);
  output.writeUInt8(0, 8);
  output.writeUInt8(0, 9);
  output.writeUInt16LE(1, 10);
  output.writeUInt16LE(32, 12);
  output.writeUInt32LE(imageBytes, 14);
  output.writeUInt32LE(imageOffset, 18);

  // BITMAPINFOHEADER. ICO stores the XOR and AND bitmap heights together.
  output.writeUInt32LE(40, imageOffset);
  output.writeInt32LE(width, imageOffset + 4);
  output.writeInt32LE(height * 2, imageOffset + 8);
  output.writeUInt16LE(1, imageOffset + 12);
  output.writeUInt16LE(32, imageOffset + 14);
  output.writeUInt32LE(0, imageOffset + 16);
  output.writeUInt32LE(pixelBytes, imageOffset + 20);

  const pixelsStart = imageOffset + 40;
  for (let index = 0; index < width * height; index += 1) {
    const offset = pixelsStart + index * 4;
    output[offset] = 184; // blue
    output[offset + 1] = 71; // green
    output[offset + 2] = 113; // red
    output[offset + 3] = 255; // alpha
  }

  return output;
};

if (!fs.existsSync(icoDestination)) {
  fs.writeFileSync(icoDestination, createPlaceholderIco());
}
