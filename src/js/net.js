const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function getJson(url, { timeout = 9000, signal } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  const onAbort = () => ctl.abort();
  signal && signal.addEventListener('abort', onAbort);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error('http ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); signal && signal.removeEventListener('abort', onAbort); }
}

// Exponential backoff: base * 2^n with jitter.
export async function withBackoff(fn, { tries = 4, base = 700 } = {}) {
  let err;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      err = e;
      if (i < tries - 1) await sleep(base * 2 ** i + Math.random() * 200);
    }
  }
  throw err;
}

// Poll every `ms`, pause while hidden, fetch immediately on visible.
export function poller(task, ms) {
  let timer = 0, busy = false, on = false;
  const run = async () => {
    if (busy || document.hidden) return;
    busy = true;
    try { await task(); } finally { busy = false; }
  };
  const loop = () => { clearTimeout(timer); timer = setTimeout(async () => { await run(); if (on && !document.hidden) loop(); }, ms); };
  const onVis = () => {
    if (document.hidden) { clearTimeout(timer); return; }
    if (on) { run().then(() => { if (on && !document.hidden) loop(); }); }
  };
  document.addEventListener('visibilitychange', onVis);
  return {
    start() { on = true; run().then(() => { if (on && !document.hidden) loop(); }); },
    stop() { on = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); },
  };
}
