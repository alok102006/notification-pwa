import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

// Create a clean SVG icon
const bellSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#1d4ed8"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="110" fill="url(#bg)"/>
  <path d="M256 96c-53 0-96 43-96 96v72l-32 48v24h256v-24l-32-48v-72c0-53-43-96-96-96zm-48 264c0 26.5 21.5 48 48 48s48-21.5 48-48h-96z" fill="#ffffff"/>
  <circle cx="368" cy="144" r="28" fill="#ef4444"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), bellSvg);

// Generate minimalist base64 1x1 or valid PNGs as placeholders or use SVG-rendered PNGs
// Simple solid valid PNG generator in pure Node without native dependencies:
import zlib from 'zlib';

function createPng(width, height, r, g, b, a = 255) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw Image Data (Filter byte 0 + RGBA per pixel)
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(rowLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      
      // Draw bell-like simple shape or colored background
      const cx = width / 2;
      const cy = height / 2;
      const dist = Math.hypot(x - cx, y - cy);
      const radius = width * 0.42;

      if (dist < radius) {
        // Center icon highlight
        const innerDist = Math.hypot(x - cx, y - (cy - 10));
        if (innerDist < width * 0.18 || (Math.abs(x - cx) < width * 0.15 && y >= cy - 10 && y <= cy + 40)) {
          rawData[pxOffset] = 255;
          rawData[pxOffset + 1] = 255;
          rawData[pxOffset + 2] = 255;
          rawData[pxOffset + 3] = 255;
        } else {
          rawData[pxOffset] = r;
          rawData[pxOffset + 1] = g;
          rawData[pxOffset + 2] = b;
          rawData[pxOffset + 3] = a;
        }
      } else {
        // Outer rounding or transparent
        rawData[pxOffset] = 37;
        rawData[pxOffset + 1] = 99;
        rawData[pxOffset + 2] = 235;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = data.length;
  const buffer = Buffer.alloc(8 + length + 4);
  buffer.writeUInt32BE(length, 0);
  buffer.write(type, 4, 4, 'ascii');
  data.copy(buffer, 8);

  const crc = crc32(buffer.subarray(4, 8 + length));
  buffer.writeUInt32BE(crc >>> 0, 8 + length);
  return buffer;
}

// Table-based CRC32
function makeCRCTable() {
  let c;
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[n] = c;
  }
  return crcTable;
}

const crcTable = makeCRCTable();
function crc32(buf) {
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

// Write icons
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192, 192, 59, 130, 246));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512, 512, 59, 130, 246));
fs.writeFileSync(path.join(publicDir, 'icon-maskable.png'), createPng(512, 512, 37, 99, 235));
fs.writeFileSync(path.join(publicDir, 'badge-72.png'), createPng(72, 72, 255, 255, 255));

console.log('✅ Generated PWA icons in public/ directory.');
