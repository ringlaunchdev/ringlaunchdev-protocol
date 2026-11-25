// Build: bundle JS/CSS with esbuild, process html, and EXPLICITLY copy brand-derived assets into dist/.
// usage: node scripts/build.mjs [--out dist] [--ca <address>]
import { build } from 'esbuild';
import { rmSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > -1 ? process.argv[i + 1] : d; };
const out = resolve(root, arg('out', 'dist'));
const ca = arg('ca', '');
if (!(out === join(root, 'dist') || out.startsWith(root) || out.includes('scratchpad'))) throw new Error('refusing to write outside project: ' + out);

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'assets'), { recursive: true });

await build({
  entryPoints: { app: join(root, 'src/js/main.js') },
  bundle: true, minify: true, format: 'iife', target: 'es2020', outdir: out, logLevel: 'error',
  define: { __RING_CA__: JSON.stringify(ca) },
});
await build({ entryPoints: { app: join(root, 'src/styles.css') }, bundle: true, minify: true, outdir: out, logLevel: 'error', loader: { '.woff2': 'file' }, assetNames: 'assets/fonts/[name]' });

// explicit asset copy (logo files used by index.html, favicon)
const REQUIRED = ['ring-1024.png', 'ring-256.png', 'ring-96.png'];
for (const f of REQUIRED) {
  const src = join(root, 'src/assets', f);
  if (!existsSync(src)) throw new Error('missing asset ' + f + ' (run npm run assets)');
  copyFileSync(src, join(out, 'assets', f));
}
copyFileSync(join(root, 'src/assets/favicon.svg'), join(out, 'favicon.svg'));

let html = readFileSync(join(root, 'src/index.html'), 'utf8');
writeFileSync(join(out, 'index.html'), html);
console.log('built ->', out, '| files:', readdirSync(out).join(', '), '| assets:', readdirSync(join(out, 'assets')).join(', '), '| ca:', ca || '(absent)');
