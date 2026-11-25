// REGISTER: every external fact is one record with state stated | absent | unconfirmed.
// Absent / unconfirmed records render inert. Nothing else in the code base hardcodes these facts.
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const caRaw = typeof __RING_CA__ === 'string' ? __RING_CA__.trim() : '';

export const register = {
  name: { state: 'stated', value: 'Ringlaunch' },
  domain: { state: 'stated', value: 'ringlaunch.dev' },
  chain: {
    state: 'stated',
    value: 'Solana',
    cluster: 'mainnet-beta',
    rpc: 'https://solana-rpc.publicnode.com',
  },
  ca: {
    state: caRaw ? (BASE58.test(caRaw) ? 'stated' : 'unconfirmed') : 'absent',
    value: caRaw || null,
  },
  x: { state: 'stated', url: 'https://x.com/ringlaunchdev' },
  github: { state: 'absent', url: null },
  market: {
    state: 'stated',
    boostsUrl: 'https://api.dexscreener.com/token-boosts/top/v1',
    tokensUrl: 'https://api.dexscreener.com/tokens/v1/solana/{addr}',
    limit: 10,
    pollMs: 60000,
  },
  ownSources: {
    state: 'stated',
    dexUrl: 'https://api.dexscreener.com/latest/dex/tokens/{addr}',
    pumpUrl: 'https://frontend-api.pump.fun/coins/{addr}',
    dexPage: 'https://dexscreener.com/solana/{addr}',
  },
};

export const isStated = (rec) => !!rec && rec.state === 'stated' && !!(rec.value || rec.url);
// LINK RULE: store the URL, derive the handle. No href for unstated records.
export const linkOf = (rec) => (isStated(rec) && rec.url ? rec.url : null);
export const handleOf = (rec) => {
  const u = linkOf(rec);
  if (!u) return null;
  try { return '@' + new URL(u).pathname.split('/').filter(Boolean)[0]; } catch { return null; }
};
export const fill = (tpl, addr) => tpl.replace('{addr}', encodeURIComponent(addr));
