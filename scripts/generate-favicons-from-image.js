import sharp from 'sharp';
import { promises as fs } from 'fs';
import { join } from 'path';

const SOURCE_IMAGE = 'public/nexus social.png';
const PUBLIC_DIR = 'public';

const FAVICON_SIZES = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
  'mstile-150x150.png': 150,
};

async function generateFavicons() {
  console.log('🎨 Generating favicons from nexus social.png...\n');

  try {
    for (const [filename, size] of Object.entries(FAVICON_SIZES)) {
      const outputPath = join(PUBLIC_DIR, filename);
      
      // Create a rounded rectangle mask
      const radius = Math.round(size * 0.15); // 15% border radius
      const roundedRect = Buffer.from(`
        <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
        </svg>
      `);
      
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .composite([{
          input: await sharp(roundedRect).toBuffer(),
          blend: 'dest-in'
        }])
        .toFile(outputPath);
      
      console.log(`✅ ${filename} (${size}x${size})`);
    }

    // Create favicon.ico from 32x32 with rounded corners
    const size = 32;
    const radius = Math.round(size * 0.15); // 15% border radius
    const roundedRect = Buffer.from(`
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
      </svg>
    `);

    const icon32 = await sharp(SOURCE_IMAGE)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .composite([{
        input: await sharp(roundedRect).toBuffer(),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    await fs.writeFile(join(PUBLIC_DIR, 'favicon.ico'), icon32);
    console.log(`✅ favicon.ico (32x32)`);

    console.log('\n🎉 All favicons generated successfully!');
    console.log('\nNext steps:');
    console.log('   1. Favicons have been generated in the public/ folder');
    console.log('   2. Favicon links in index.html point to these files');
    console.log('   3. Favicons should now appear in all browsers\n');

  } catch (error) {
    console.error('❌ Error generating favicons:', error.message);
    console.log('\nPlease ensure:');
    console.log('   1. sharp is installed: npm install sharp');
    console.log('   2. nexus social.png exists in the public folder\n');
    process.exit(1);
  }
}

generateFavicons();
