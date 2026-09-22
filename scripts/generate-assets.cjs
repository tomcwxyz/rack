const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const iconDirectory = path.join(root, 'apps/desktop/src-tauri/icons');
const pngSource = path.join(iconDirectory, 'icon.png.b64');
const pngDestination = path.join(iconDirectory, 'icon.png');
const icoDestination = path.join(iconDirectory, 'icon.ico');

if (fs.existsSync(pngSource)) {
  fs.writeFileSync(
    pngDestination,
    Buffer.from(fs.readFileSync(pngSource, 'utf8').trim(), 'base64'),
  );
}

const createRackIco = () => {
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
  const paper = [232, 239, 242, 255]; // BGRA for #f2efe8
  const accent = [184, 71, 113, 255]; // BGRA for #7147b8
  const moss = [67, 92, 49, 255]; // BGRA for #315c43

  const insideRoundedTile = (x, y) => {
    const inset = 2;
    const radius = 7;
    if (x < inset || x >= width - inset || y < inset || y >= height - inset) return false;
    const cx = x < inset + radius ? inset + radius : x >= width - inset - radius ? width - inset - radius - 1 : x;
    const cy = y < inset + radius ? inset + radius : y >= height - inset - radius ? height - inset - radius - 1 : y;
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  const isRail = (x, y) =>
    y >= 7 && y <= 25 && ((x >= 9 && x <= 11) || (x >= 21 && x <= 23));
  const isRung = (x, y) =>
    x >= 11 && x <= 21 && (
      (y >= 10 && y <= 11) ||
      (y >= 15 && y <= 16) ||
      (y >= 20 && y <= 21)
    );

  // ICO DIB rows are bottom-up.
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dibY = height - 1 - y;
      const offset = pixelsStart + (dibY * width + x) * 4;
      let colour = [0, 0, 0, 0];

      if (insideRoundedTile(x, y)) colour = paper;
      if (isRail(x, y) || isRung(x, y)) colour = accent;
      if (x >= 11 && x <= 21 && y >= 15 && y <= 16) colour = moss;

      output[offset] = colour[0];
      output[offset + 1] = colour[1];
      output[offset + 2] = colour[2];
      output[offset + 3] = colour[3];
    }
  }

  return output;
};

fs.writeFileSync(icoDestination, createRackIco());
