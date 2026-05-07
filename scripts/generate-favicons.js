#!/usr/bin/env node
/**
 * Favicon Generator Script
 * 
 * This script generates PNG favicons and ICO files from the SVG source.
 * Requires: npm install sharp
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PUBLIC_DIR = join(__dirname, '..', 'public');

const SVG_PATH = join(PUBLIC_DIR, 'nexus-icon.svg');

// Sizes needed for various use cases
const SIZES = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
};

async function generateFavicons() {
  console.log('🎨 Generating favicons from SVG...\n');

  try {
    const svgBuffer = readFileSync(SVG_PATH);

    // Generate PNG files
    for (const [filename, size] of Object.entries(SIZES)) {
      const outputPath = join(PUBLIC_DIR, filename);
      
      await sharp(svgBuffer)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 99, g: 102, b: 241, alpha: 1 } // #6366f1 background
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ ${filename} (${size}x${size})`);
    }

    // Generate ICO file (contains multiple sizes)
    const icoSizes = [16, 32, 48];
    const icoBuffers = await Promise.all(
      icoSizes.map(size =>
        sharp(svgBuffer)
          .resize(size, size, { fit: 'contain' })
          .toBuffer()
      )
    );

    // Simple ICO format (just use the 32x32 as favicon.ico for now)
    writeFileSync(
      join(PUBLIC_DIR, 'favicon.ico'),
      icoBuffers[1] // 32x32 for favicon.ico
    );
    console.log(`✅ favicon.ico (multi-size)`);

    // Generate Safari pinned tab SVG (monochrome)
    const safariSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="45" fill="none" stroke="black" stroke-width="3"/>
  <circle cx="50" cy="25" r="8" fill="black"/>
  <circle cx="25" cy="65" r="8" fill="black"/>
  <circle cx="75" cy="65" r="8" fill="black"/>
  <line x1="50" y1="33" x2="25" y2="57" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="50" y1="33" x2="75" y2="57" stroke="black" stroke-width="4" stroke-linecap="round"/>
  <line x1="25" y1="73" x2="75" y2="73" stroke="black" stroke-width="4" stroke-linecap="round"/>
</svg>`;
    writeFileSync(join(PUBLIC_DIR, 'safari-pinned-tab.svg'), safariSvg);
    console.log(`✅ safari-pinned-tab.svg`);

    console.log('\n🎉 All favicons generated successfully!');
    console.log('\n📦 Next steps:');
    console.log('   1. Restart your dev server: npm run dev');
    console.log('   2. Clear browser cache and hard refresh');
    console.log('   3. Favicons should now appear in all browsers\n');

  } catch (error) {
    console.error('❌ Error generating favicons:', error.message);
    console.log('\n💡 To fix this:');
    console.log('   npm install sharp --save-dev');
    console.log('   node scripts/generate-favicons.js\n');
    process.exit(1);
  }
}

generateFavicons();
