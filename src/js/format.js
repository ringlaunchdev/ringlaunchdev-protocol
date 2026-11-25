const DASH = '—';
export const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export function usdCompact(v) {
  if (!isNum(v)) return DASH;
  const a = Math.abs(v);
  const f = (d, s) => '$' + (v / d).toFixed(a / d >= 100 ? 0 : a / d >= 10 ? 1 : 2) + s;
  if (a >= 1e12) return f(1e12, 'T');
  if (a >= 1e9) return f(1e9, 'B');
  if (a >= 1e6) return f(1e6, 'M');
  if (a >= 1e3) return f(1e3, 'K');
  return '$' + v.toFixed(0);
}
export function usdPrice(v) {
  if (!isNum(v)) return DASH;
  if (v === 0) return '$0';
  if (v >= 1000) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (v >= 1) return '$' + v.toFixed(2);
  if (v >= 0.01) return '$' + v.toFixed(4);
  return '$' + v.toPrecision(3).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}
export function pct(v) {
  if (!isNum(v)) return DASH;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 2) + '%';
}
export const toNum = (v) => { const n = typeof v === 'string' ? parseFloat(v) : v; return isNum(n) ? n : null; };
export const DASH_CHAR = DASH;
