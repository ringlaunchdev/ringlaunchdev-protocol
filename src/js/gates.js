// GATE WARNING: address-shaped strings are matched against the stated registry.
// 0x hex is never blanket-rejected; it only warns when it is not a stated record.
// The CA itself is exempt from the scanner.
import { register, isStated } from './register.js';

const SHAPES = [
  { kind: 'base58', re: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g },
  { kind: 'hex0x', re: /\b0x[0-9a-fA-F]{40}\b/g },
];

export function scanAddressShapes(text) {
  const out = [];
  for (const { kind, re } of SHAPES) for (const m of text.matchAll(re)) out.push({ kind, value: m[0] });
  return out;
}

export function gateWarnings(text, reg = register) {
  const stated = new Set();
  if (isStated(reg.ca)) stated.add(reg.ca.value);
  return scanAddressShapes(text).filter((h) => !stated.has(h.value));
}

export function runGateScan(root = document) {
  let n = 0;
  root.querySelectorAll('[data-copy]').forEach((el) => {
    if (el.hasAttribute('data-ca-exempt')) return;
    const w = gateWarnings(el.textContent || '');
    if (w.length) { el.setAttribute('data-gate-warning', w.map((x) => x.kind).join(',')); n += w.length; }
  });
  return n;
}
