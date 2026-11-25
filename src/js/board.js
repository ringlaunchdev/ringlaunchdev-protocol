import { usdPrice, usdCompact, pct, isNum, DASH_CHAR } from './format.js';
import { setNum } from './fx.js';
import { register, isStated, fill } from './register.js';

const SORT = {
  boost: (a, b) => b.boost - a.boost,
  gain: (a, b) => (b.chg ?? -Infinity) - (a.chg ?? -Infinity),
  vol: (a, b) => (b.vol ?? -1) - (a.vol ?? -1),
  liq: (a, b) => (b.liq ?? -1) - (a.liq ?? -1),
};
const FILTER = {
  all: () => true,
  up: (r) => isNum(r.chg) && r.chg > 0,
  down: (r) => isNum(r.chg) && r.chg < 0,
  deep: (r) => isNum(r.liq) && r.liq >= 100000,
};
const PILL = {
  loading: ['Syncing', 'sync'], live: ['Live feed', 'live'], retrying: ['Reconnecting', 'warn'],
  error: ['Feed offline', 'bad'], off: ['Feed idle', 'bad'],
};

const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function tile(symbol) { return el('span', 'tile', esc((symbol || '?').replace(/^\$/, '').slice(0, 2).toUpperCase())); }
function fillLogo(host, cands, symbol) {
  const sig = cands.join('|') + '#' + symbol;
  if (host.dataset.sig === sig) return;
  host.dataset.sig = sig; host.textContent = '';
  let i = 0;
  const next = () => {
    if (i >= cands.length) { host.textContent = ''; host.appendChild(tile(symbol)); return; }
    const img = new Image();
    img.alt = ''; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
    img.onload = () => { host.textContent = ''; host.appendChild(img); };
    img.onerror = () => { i++; next(); };
    img.src = cands[i];
  };
  host.appendChild(tile(symbol)); next();
}

function buildRow(kind, href) {
  const root = el(href ? 'a' : 'div', 'row' + (kind === 'own' ? ' own' : ''));
  root.setAttribute('data-spot', '');
  if (href) { root.href = href; root.target = '_blank'; root.rel = 'noreferrer noopener'; }
  else if (kind === 'own') root.setAttribute('aria-disabled', 'true');
  root.innerHTML =
    '<span class="rk"></span>' +
    '<span class="tk"><span class="logo"></span><span class="nm"><b></b><i></i></span></span>' +
    '<span class="c c-price" data-label="Price"><span class="v"></span></span>' +
    '<span class="c c-chg" data-label="24h"><span class="v"></span></span>' +
    '<span class="c c-vol" data-label="Volume"><span class="v"></span></span>' +
    '<span class="c c-liq" data-label="Liquidity"><span class="v"></span></span>';
  return root;
}
function paint(root, d, rank) {
  root.querySelector('.rk').textContent = rank;
  fillLogo(root.querySelector('.logo'), d.logos || [], d.symbol);
  root.querySelector('.nm b').textContent = '$' + d.symbol.replace(/^\$/, '');
  root.querySelector('.nm i').textContent = d.name || '';
  const q = (c) => root.querySelector(c + ' .v');
  if (d.placeholder) {
    root.classList.add('ph');
    q('.c-price').textContent = '· · · · ·'; ['.c-chg', '.c-vol', '.c-liq'].forEach((c) => (q(c).textContent = ''));
    return;
  }
  root.classList.remove('ph');
  setNum(q('.c-price'), d.price, usdPrice);
  setNum(q('.c-chg'), d.chg, pct);
  setNum(q('.c-vol'), d.vol, usdCompact);
  setNum(q('.c-liq'), d.liq, usdCompact);
  const c = q('.c-chg').parentElement;
  c.classList.toggle('up', isNum(d.chg) && d.chg > 0); c.classList.toggle('down', isNum(d.chg) && d.chg < 0);
}

export function createBoard(ui, brandLogo) {
  const S = { tab: 'boost', pill: 'all', market: { status: 'loading', rows: [] }, own: null };
  const rowEls = new Map();
  let ownEl = null, skel = [], seenData = false, tapeSig = '';

  function skeleton(n) {
    if (skel.length) return;
    for (let i = 0; i < n; i++) { const s = el('div', 'row skel', '<span class="sk sk-a"></span><span class="sk sk-b"></span><span class="sk sk-c"></span>'); skel.push(s); ui.rows.appendChild(s); }
  }
  function clearSkeleton() {
    skel.forEach((s) => { s.classList.add('leaving'); setTimeout(() => s.remove(), 220); }); skel = [];
  }

  function renderOwn() {
    const v = S.own; if (!v) return;
    if (!ownEl) { ownEl = buildRow('own', v.live ? v.href : null); ui.rows.prepend(ownEl); ownEl.classList.add('enter'); }
    if (v.live && ownEl.tagName === 'A' && v.href) ownEl.href = v.href;
    paint(ownEl, v.live ? v : { ...v, placeholder: true }, 1);
  }

  function render() {
    renderOwn();
    const m = S.market;
    const [label, state] = PILL[m.status] || PILL.off;
    ui.pills.forEach((p) => { p.dataset.state = state; p.querySelector('[data-pill-label]').textContent = label; });
    const ownAddr = isStated(register.ca) ? register.ca.value : null;
    let list = m.rows.filter((r) => r.addr !== ownAddr); // dedup own token out of rows 2-10
    list = list.filter(FILTER[S.pill]).sort(SORT[S.tab]);
    ui.err.hidden = !(m.status === 'error' || m.status === 'retrying');
    ui.err.textContent = m.status === 'error' ? 'Market source unreachable. Retrying with backoff; figures show a dash until it answers.'
      : m.status === 'retrying' ? 'Refresh failed. Previous figures stay visible while retries continue.' : '';

    if (!m.rows.length && m.status === 'loading') skeleton(9);
    if (m.rows.length) { clearSkeleton(); seenData = true; }

    const keep = new Set(['own']);
    const desired = [ownEl];
    if (!m.rows.length && m.status === 'error') {
      if (!rowEls.has('dash')) { const r = buildRow('dash', null); rowEls.set('dash', r); r.classList.add('enter'); }
      paint(rowEls.get('dash'), { symbol: DASH_CHAR, name: 'No data', logos: [], price: null, chg: null, vol: null, liq: null }, 2);
      keep.add('dash'); desired.push(rowEls.get('dash'));
    }
    list.forEach((r, i) => {
      let row = rowEls.get(r.key);
      if (!row) {
        row = buildRow('t', fill(register.ownSources.dexPage, r.addr)); rowEls.set(r.key, row);
        row.classList.add('enter'); row.style.animationDelay = Math.min(i, 12) * 45 + 'ms';
      }
      paint(row, r, i + 2); keep.add(r.key); desired.push(row);
    });
    rowEls.forEach((row, k) => { if (!keep.has(k)) { row.remove(); rowEls.delete(k); } });
    let ref = ui.rows.firstChild;
    desired.forEach((n) => { if (n === ref) ref = ref.nextSibling; else ui.rows.insertBefore(n, ref); });
    ui.count.textContent = (list.length + 1) + ' listed';
    renderTape();
  }

  function renderTape() {
    const items = [];
    const o = S.own;
    if (o && o.live && o.symbol) items.push({ key: 'own', symbol: o.symbol, price: o.price, chg: o.chg, logos: o.logos });
    S.market.rows.forEach((r) => { if (!(o && o.live && r.addr === o.addr)) items.push(r); });
    if (!items.length) return;
    const sig = items.map((i) => i.key).join(',');
    const build = (suffix) => items.map((r) =>
      `<span class="ti" data-k="${esc(r.key)}"><span class="logo sm"></span><b>$${esc(r.symbol.replace(/^\$/, ''))}</b><span class="tp"></span><span class="tc"></span></span>`).join('');
    if (sig !== tapeSig) {
      tapeSig = sig;
      ui.tape.innerHTML = '<div class="tape-seq">' + build() + '</div><div class="tape-seq" aria-hidden="true">' + build() + '</div>';
      ui.tape.classList.remove('skeleton');
    }
    ui.tape.querySelectorAll('.ti').forEach((n) => {
      const r = items.find((x) => String(x.key) === n.dataset.k); if (!r) return;
      fillLogo(n.querySelector('.logo'), r.logos || [], r.symbol);
      n.querySelector('.tp').textContent = usdPrice(r.price);
      const tc = n.querySelector('.tc'); tc.textContent = pct(r.chg);
      tc.className = 'tc ' + (isNum(r.chg) ? (r.chg > 0 ? 'up' : r.chg < 0 ? 'down' : '') : '');
    });
  }

  ui.tabs.forEach((b) => b.addEventListener('click', () => {
    S.tab = b.dataset.tab; ui.tabs.forEach((x) => { const on = x === b; x.setAttribute('aria-selected', on); x.classList.toggle('on', on); }); render();
  }));
  ui.chips.forEach((b) => b.addEventListener('click', () => {
    S.pill = b.dataset.pill; ui.chips.forEach((x) => { const on = x === b; x.setAttribute('aria-pressed', on); x.classList.toggle('on', on); }); render();
  }));

  return {
    setMarket(m) { S.market = m; render(); },
    setOwn(v) { S.own = v; render(); },
  };
}
