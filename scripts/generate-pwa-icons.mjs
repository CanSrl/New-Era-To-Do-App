import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, '..', 'public');

const anySvg = readFileSync(path.join(publicDir, 'favicon.svg'));
const maskableSvg = readFileSync(path.join(publicDir, 'logo-maskable-source.svg'));

async function render(svgBuffer, size, outFile, { flatten } = {}) {
    let pipeline = sharp(svgBuffer, { density: 384 }).resize(size, size);
    if (flatten) pipeline = pipeline.flatten({ background: '#0f172a' });
    await pipeline.png().toFile(path.join(publicDir, outFile));
    console.log(`wrote ${outFile} (${size}x${size})`);
}

await render(anySvg, 192, 'pwa-192x192.png');
await render(anySvg, 512, 'pwa-512x512.png');
await render(maskableSvg, 512, 'pwa-512x512-maskable.png');
await render(maskableSvg, 180, 'apple-touch-icon.png', { flatten: true });

console.log('PWA icon generation complete.');
