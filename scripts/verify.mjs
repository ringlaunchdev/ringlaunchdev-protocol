// Gate harness. usage: node scripts/verify.mjs [--ref path/to/reference-text.txt]
import { readFileSync, existsSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(root, p), 'utf8');
const results = [];
const gate = (name, ok, detail = '') => { results.push({ name, ok }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' — ' + detail : '')); };
const walk = (d, out = []) => { for (const f of readdirSync(d)) { if (['node_modules', '.git'].includes(f)) continue; const p = join(d, f); statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };

// ---- dist + logo
const dist = join(root, 'dist');
const html = existsSync(join(dist, 'index.html')) ? readFileSync(join(dist, 'index.html'), 'utf8') : '';
gate('dist/index.html exists', !!html);
const refs = [...html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g)].map((m) => m[1]);
const missing = refs.filter((r) => !existsSync(join(dist, r)));
gate('every relative reference in dist/index.html resolves', refs.length > 0 && !missing.length, missing.join(','));
const logoRefs = refs.filter((r) => /assets\/ring-\d+\.png$/.test(r));
gate('logo referenced with relative path and present in dist/', logoRefs.length >= 3 && logoRefs.every((r) => existsSync(join(dist, r))), logoRefs.join(' '));
const png = readFileSync(join(dist, 'assets/ring-256.png'));
gate('dist logo is real RGBA PNG (IHDR colortype 6)', png.readUInt32BE(16) === 256 && png[25] === 6);
gate('build script explicitly copies logo files', /copyFileSync\(src, join\(out, 'assets', f\)\)/.test(rd('scripts/build.mjs')) && /ring-1024\.png/.test(rd('scripts/build.mjs')));
const fav = readFileSync(join(dist, 'favicon.svg'), 'utf8');
gate('favicon is 32x32 SVG traced from pixel grid', /width="32" height="32" viewBox="0 0 32 32"/.test(fav) && (fav.match(/<rect /g) || []).length > 100);

// ---- palette + units
const srcFiles = walk(join(root, 'src')).filter((f) => /\.(css|js|html)$/.test(f));
const hexRe = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;
const stray = srcFiles.filter((f) => !f.endsWith('tokens.css') && hexRe.test(readFileSync(f, 'utf8')) );
hexRe.lastIndex = 0;
gate('colour literals live only in src/tokens.css', stray.length === 0, stray.map((s) => s.replace(root, '')).join(','));
const distText = (html);
gate('no hex literals in dist/index.html', !hexRe.test(distText));
gate('tokens.css documents provenance', /Provenance/.test(rd('src/tokens.css')) && /sampled from brand/.test(rd('src/tokens.css')));
gate('no ch units anywhere in src', !srcFiles.some((f) => /\d(?:\.\d+)?ch\b/.test(readFileSync(f, 'utf8'))));

// ---- dates
const visible = rd('src/index.html').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
const jsAll = srcFiles.filter((f) => f.endsWith('.js')).map((f) => readFileSync(f, 'utf8')).join('\n');
const dateRe = /\b(19|20)\d{2}\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d|\bago\b|\bas of\b|\bchecked\b|\bupdated\b|\b\d{1,2}:\d{2}\b|\bUTC\b/i;
gate('no dates, timestamps or clock strings in page copy', !dateRe.test(visible));
gate('no Date / locale-time calls in JS', !/\bDate\b|toLocale(?:Date|Time)String|toISOString/.test(jsAll));

// ---- register / link rule / address gate (runtime modules)
globalThis.__RING_CA__ = '';
const reg = await import(pathToFileURL(join(root, 'src/js/register.js')).href);
const gates = await import(pathToFileURL(join(root, 'src/js/gates.js')).href);
gate('LINK RULE: stated X yields href + derived handle', reg.linkOf(reg.register.x) === 'https://x.com/ringlaunchdev' && reg.handleOf(reg.register.x) === '@ringlaunchdev');
gate('LINK RULE: absent GitHub yields no href', reg.linkOf(reg.register.github) === null && reg.register.github.state === 'absent');
gate('REGISTER: CA absent branch is inert', reg.register.ca.state === 'absent' && !reg.isStated(reg.register.ca));
const fakeCA = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const statedReg = { ca: { state: 'stated', value: fakeCA } };
gate('GATE: CA exempt from address scanner when stated', gates.gateWarnings('contract ' + fakeCA, statedReg).length === 0);
gate('GATE: same string warns when CA not stated', gates.gateWarnings('contract ' + fakeCA, reg.register).length === 1);
const evm = '0x' + 'ab12'.repeat(10);
const evmW = gates.gateWarnings('send to ' + evm, statedReg);
gate('GATE: 0x hex is matched, not blanket-rejected (warn only, no throw)', evmW.length === 1 && evmW[0].kind === 'hex0x');
gate('GATE: 0x hex passes when it is the stated record', gates.gateWarnings(evm, { ca: { state: 'stated', value: evm } }).length === 0);
gate('GATE: ordinary words are not address-shaped', gates.gateWarnings(visible).length === 0);

// ---- both CA branches, built bundles
const tmp = join(root, '.verify-stated');
execFileSync(process.execPath, [join(root, 'scripts/build.mjs'), '--out', tmp, '--ca', fakeCA], { stdio: 'ignore' });
const bundleStated = readFileSync(join(tmp, 'app.js'), 'utf8'), bundleAbsent = readFileSync(join(dist, 'app.js'), 'utf8');
gate('BRANCH stated: bundle carries CA, handlers present', bundleStated.includes(fakeCA) && bundleStated.includes('writeText'));
gate('BRANCH absent: shipped dist/ bundle carries no CA', !bundleAbsent.includes(fakeCA) && /unconfirmed/.test(bundleAbsent));
rmSync(tmp, { recursive: true, force: true });

// ---- parallel fetch + market independence
const own = rd('src/js/own.js');
const cycleBody = own.slice(own.indexOf('async function cycle'), own.indexOf('const p = live'));
gate('PUMP PARALLEL: pump.fun and DexScreener started independently, never awaited together', /dexUrl/.test(cycleBody) && /pumpUrl/.test(cycleBody) && !/\bawait\b/.test(cycleBody) && !/Promise\.all\b/.test(cycleBody));
const mk = rd('src/js/market.js');
gate('MARKET: reads only the market register record', !/register\.ca|from '\.\/own|from '\.\/ca/.test(mk) && /register\.market/.test(mk));
gate('MARKET: solana filter, top 10 by totalAmount, backoff', /chainId === 'solana'/.test(mk) && /totalAmount/.test(mk) && /withBackoff/.test(mk) && /limit: 10/.test(rd('src/js/register.js')));
gate('POLL: 60s, hidden-pause, immediate on visible', /pollMs: 60000/.test(rd('src/js/register.js')) && /document\.hidden/.test(rd('src/js/net.js')) && /visibilitychange/.test(rd('src/js/net.js')));
const css = rd('src/styles.css');
gate('OWN ROW: accent border-left, pulse, reduced-motion none', /border-left:2px solid var\(--color-accent\)/.test(css) && /ownPulse/.test(css) && /prefers-reduced-motion: reduce[\s\S]*\.row\.own\{animation:none\}/.test(css));
gate('OWN ROW: absent state uses brand logo, not letter tile', /logos: \[brandLogo\]/.test(own));
gate('OWN ROW: logo priority pump -> dex -> brand', /pump\?\.image_uri, pair\?\.info\?\.imageUrl, brandLogo/.test(own));
gate('OWN ROW: dedup of own token from trending rows', /r\.addr !== ownAddr/.test(rd('src/js/board.js')));
gate('SOCIAL: both icons in header markup, 44px targets', (rd('src/index.html').match(/class="soc"/g) || []).length === 2 && /\.soc\{[^}]*width:44px;height:44px/.test(css));

// ---- animation audit + reference value parity
const kf = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((m) => m[1]);
const unused = kf.filter((k) => !new RegExp('animation(?:-name)?:[^;}]*\\b' + k + '\\b').test(css));
gate('ANIM: every @keyframes (' + kf.join(',') + ') is applied to an element', kf.length >= 9 && !unused.length, unused.join(','));
gate('ANIM: reduced-motion kills animation + transition globally, own row, ticker, hero', /prefers-reduced-motion: reduce\)\{\s*\*,\*::before,\*::after\{animation:none!important;transition:none!important/.test(css) && /\.row\.own\{animation:none\}/.test(css) && /\.wave,\.ring\{animation:none\}/.test(css));
gate('ANIM: JS motion falls back instantly under reduced motion', ['spring', 'initParallax', 'initMesh', 'initSmoothScroll', 'setNum'].every((f) => new RegExp('function ' + f + '[\\s\\S]{0,2600}reduced\\(\\)').test(rd('src/js/fx.js'))));
gate('PARITY: pulse 2s cubic-bezier(.4,0,.6,1), flash 1.4s ease-out, fade .3s, as studied', /animation:pulse 2s cubic-bezier\(\.4,0,\.6,1\) infinite/.test(css) && /animation:flash 1\.4s ease-out/.test(css) && /animation:fade \.3s/.test(css) && /@keyframes tape\{to\{transform:translateX\(-50%\)\}\}/.test(css));
gate('PARITY: smooth scroll lerp .085 as studied', /LERP = 0\.085/.test(rd('src/js/fx.js')));
const tk = rd('src/tokens.css');
gate('PARITY: radii 6/8/12/16/24, sidebar 220, header 64, page 1320', /--r-md: 6px; --r-lg: 8px; --r-xl: 12px; --r-2xl: 16px; --r-3xl: 24px/.test(tk) && /--sidebar-w: 220px; --header-h: 64px; --page-max: 1320px/.test(tk));
gate('PARITY: card 184px, 16px gap, padding 20px; Space Grotesk self-hosted in dist', /\.card\{height:184px;padding:20px/.test(css) && /\.cards\{display:grid;gap:16px\}/.test(css) && existsSync(join(dist, 'assets/fonts/space-grotesk-latin-400-normal.woff2')) && /font-family:"Space Grotesk"/.test(rd('src/styles.css')));

// ---- hygiene
const hyg = [...walk(root).filter((f) => !/node_modules|[\\/]dist[\\/]|[\\/]brand[\\/]|[\\/]reference[\\/]|package-lock|\.png$|\.jpe?g$|\.jpeg$|verify\.mjs$/.test(f))];
const bad = new RegExp(['co-authored', 'generated with', 'anthr' + 'opic', 'cla' + 'ude', 'chat' + 'gpt', 'AI-generated'].join('|'), 'i');
gate('REPO HYGIENE: no CLAUDE.md or .claude/', !existsSync(join(root, 'CLAUDE.md')) && !existsSync(join(root, '.claude')));
gate('REPO HYGIENE: no AI attribution strings', !hyg.filter((f) => bad.test(readFileSync(f, 'utf8'))).length, hyg.filter((f) => bad.test(readFileSync(f, 'utf8'))).join(','));
gate('repo files present (README, whitepaper, MIT LICENSE)', existsSync(join(root, 'README.md')) && existsSync(join(root, 'docs/whitepaper.md')) && /MIT License/.test(rd('LICENSE')) && /Copyright \(c\) 2026 RINGLAUNCH/.test(rd('LICENSE')));

// ---- copy originality vs studied reference (2-grams)
const ri = process.argv.indexOf('--ref');
if (ri > -1) {
  const words = (t) => t.toLowerCase().replace(/[^a-z0-9$ ]+/g, ' ').split(/\s+/).filter(Boolean);
  const grams = (w) => new Set(w.slice(1).map((_, i) => w[i] + ' ' + w[i + 1]));
  const strings = [...jsAll.matchAll(/'([^'\n]{6,})'/g)].map((m) => m[1]).filter((s) => / /.test(s) && !/[{}=;]/.test(s) && !/^(?:\.|#|\w+\/)/.test(s));
  const mine = visible + ' ' + strings.join(' ') + ' ' + rd('README.md') + ' ' + rd('docs/whitepaper.md');
  const a = grams(words(mine)), b = grams(words(readFileSync(ri > -1 ? process.argv[ri + 1] : '', 'utf8')));
  const shared = [...a].filter((g) => b.has(g));
  gate('COPY: zero shared 2-grams with reference', shared.length === 0, shared.slice(0, 40).join(' | '));
}

const fails = results.filter((r) => !r.ok).length;
console.log(`\nGATES: ${results.length} total, ${results.length - fails} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
