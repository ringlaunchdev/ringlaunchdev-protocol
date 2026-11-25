// Live market. Reads the market-source register record only; CA state has zero effect here.
import { register, isStated, fill } from './register.js';
import { getJson, withBackoff, poller } from './net.js';
import { toNum } from './format.js';

export function createMarket(onChange) {
  const rec = register.market;
  let rows = [];
  let status = isStated(rec) || rec.state === 'stated' ? 'loading' : 'off';
  const emit = () => onChange({ status, rows });

  function toRow(addr, boost, pairs) {
    const pair = (pairs || []).slice().sort((a, b) => (toNum(b.volume?.h24) || 0) - (toNum(a.volume?.h24) || 0))[0];
    if (!pair) return null;
    return {
      key: addr,
      addr,
      symbol: pair.baseToken?.symbol || '?',
      name: pair.baseToken?.name || '',
      price: toNum(pair.priceUsd),
      chg: toNum(pair.priceChange?.h24),
      vol: toNum(pair.volume?.h24),
      liq: toNum(pair.liquidity?.usd),
      logos: [pair.info?.imageUrl, boost.icon].filter(Boolean),
      boost: toNum(boost.totalAmount) || 0,
    };
  }

  async function cycle() {
    if (rec.state !== 'stated') return;
    try {
      const boosts = await withBackoff(() => getJson(rec.boostsUrl));
      const seen = new Set();
      const top = (Array.isArray(boosts) ? boosts : [])
        .filter((b) => b.chainId === 'solana' && b.tokenAddress && !seen.has(b.tokenAddress) && seen.add(b.tokenAddress))
        .sort((a, b) => (toNum(b.totalAmount) || 0) - (toNum(a.totalAmount) || 0))
        .slice(0, rec.limit);
      const results = await Promise.allSettled(
        top.map((b) => withBackoff(() => getJson(fill(rec.tokensUrl, b.tokenAddress)), { tries: 3 })));
      const next = [];
      top.forEach((b, i) => {
        const r = results[i];
        const fresh = r.status === 'fulfilled' ? toRow(b.tokenAddress, b, r.value) : null;
        const old = rows.find((x) => x.key === b.tokenAddress);
        const row = fresh || old;
        if (row) next.push({ ...row, boost: toNum(b.totalAmount) || 0 });
      });
      if (!next.length) throw new Error('empty');
      rows = next; status = 'live';
    } catch {
      status = rows.length ? 'retrying' : 'error'; // last good data is kept on refresh failure
    }
    emit();
  }

  const p = poller(cycle, rec.pollMs);
  return { start() { emit(); p.start(); }, stop: p.stop };
}
