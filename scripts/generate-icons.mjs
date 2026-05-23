/**
 * One-time script to generate PWA app icons from an inline SVG.
 * Run with: node scripts/generate-icons.mjs
 * Output goes to public/icons/ — commit those files, not this script's output.
 */

import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '../public/icons');
mkdirSync(outDir, { recursive: true });

// "SN" initials on accent-blue rounded rectangle
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" ry="96" fill="#0066cc"/>
  <text
    x="256"
    y="330"
    font-size="248"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
    font-weight="700"
    fill="white"
    text-anchor="middle"
    dominant-baseline="auto"
    letter-spacing="-8"
  >SN</text>
</svg>`;

const buf = Buffer.from(svg);

const sizes = [
  { file: 'favicon-32.png',       size: 32  },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png',         size: 192 },
  { file: 'icon-512.png',         size: 512 },
];

for (const { file, size } of sizes) {
  const dest = resolve(outDir, file);
  await sharp(buf).resize(size, size).png().toFile(dest);
  console.log(`✓ ${file} (${size}×${size})`);
}

console.log('\nAll icons written to public/icons/');
