// Own-token row. Trigger: CA state. DexScreener and pump.fun are fetched in parallel,
// each applied the moment it resolves; neither awaits the other.
import { register, isStated, fill } from './register.js';
import { getJson, withBackoff, poller } from './net.js';
import { toNum } from './format.js';

export function createOwn(brandLogo, onChange) {
  const ca = register.ca;
  const live = isStated(ca);
  let pair = null, pump = null;

  const view = () => {
    if (!live) return { live: false, symbol: 'RING', name: 'Contract pending', logos: [brandLogo] };
    const sym = pump?.symbol || pair?.baseToken?.symbol || 'RING';
    return {
      live: true, addr: ca.value, symbol: sym,
      name: pump?.name || pair?.baseToken?.name || '',
      price: toNum(pair?.priceUsd), chg: toNum(pair?.priceChange?.h24),
      vol: toNum(pair?.volume?.h24), liq: toNum(pair?.liquidity?.usd),
      // logo order: pump.fun -> DexScreener -> brand/ -> letter tile (final fallback in UI)
      logos: [pump?.image_uri, pair?.info?.imageUrl, brandLogo].filter(Boolean),
      href: fill(register.ownSources.dexPage, ca.value),
    };
  };
  const emit = () => onChange(view());

  async function cycle() {
    const src = register.ownSources;
    withBackoff(() => getJson(fill(src.dexUrl, ca.value)), { tries: 3 }).then((j) => {
      const pairs = (j.pairs || []).filter((p) => p.chainId === 'solana' || !p.chainId);
      pair = pairs.sort((a, b) => (toNum(b.volume?.h24) || 0) - (toNum(a.volume?.h24) || 0))[0] || null;
      emit();
    }).catch(() => {});
    withBackoff(() => getJson(fill(src.pumpUrl, ca.value)), { tries: 3 }).then((j) => { pump = j; emit(); }).catch(() => {});
  }

  const p = live ? poller(cycle, register.market.pollMs) : null;
  return { start() { emit(); p && p.start(); }, stop() { p && p.stop(); }, view };
}
