// Pure Node.js PNG icon generator script
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Icon color variants: accent (red) for active YouTube, gray for disabled
const ICON_VARIANTS = [
  { suffix: '',       r: 255, g: 42,  b: 75 },   // Red accent #ff2a4b (active on YouTube)
  { suffix: '_gray',  r: 108, g: 117, b: 125 }, // Gray #6c757d (disabled/inactive)
];

function generatePngBuffer(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with scanline filter bytes
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const cx = width / 2;
      const cy = height / 2;
      const radius = width / 2 - 1;
      const dx = x - cx;
      const dy = y - cy;

      let pixelR = r;
      let pixelG = g;
      let pixelB = b;

      // Outer circle fill (accent color)
      if (dx * dx + dy * dy <= radius * radius) {
        // Draw play triangle in white inside (always white for contrast)
        const inPlayTriangle = (x >= width * 0.38 && x <= width * 0.68 &&
          Math.abs(y - cy) <= (x - width * 0.38) * 0.8);
        if (inPlayTriangle) {
          pixelR = 255;
          pixelG = 255;
          pixelB = 255;
        }
      } else {
        // Background dark
        pixelR = 13;
        pixelG = 15;
        pixelB = 20;
      }

      row[1 + x * 3] = pixelR;
      row[1 + x * 3 + 1] = pixelG;
      row[1 + x * 3 + 2] = pixelB;
    }
    rawRows.push(row);
  }
  const rawData = Buffer.concat(rawRows);
  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);

  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, body, crcBuf]);
}

// CRC32 implementation for PNG chunks
function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    let byte = buf[i];
    crc ^= byte;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
    }
  }
  return (crc ^ -1) >>> 0;
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

[16, 32, 48, 128].forEach(size => {
  ICON_VARIANTS.forEach(({ suffix, r, g, b }) => {
    const iconBuffer = generatePngBuffer(size, size, r, g, b);
    const filename = suffix ? `icon${size}${suffix}.png` : `icon${size}.png`;
    fs.writeFileSync(path.join(iconsDir, filename), iconBuffer);
    console.log(`Generated ${filename} (${size}x${size})`);
  });
});
