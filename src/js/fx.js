// Motion layer. Every function degrades to instant / static under prefers-reduced-motion.
const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => mq.matches;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Damped spring solver (semi-implicit Euler, fixed 1/120s step). Resolves 0 -> 1.
export function spring(onUpdate, { k = 170, c = 22, m = 1, delay = 0 } = {}) {
  if (reduced()) { onUpdate(1); return Promise.resolve(); }
  return new Promise((res) => {
    let x = 0, v = 0, last = 0, started = false;
    const t0 = performance.now() + delay;
    const step = (now) => {
      if (now < t0) return requestAnimationFrame(step);
      if (!started) { started = true; last = now; }
      let dt = Math.min(0.05, (now - last) / 1000); last = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 120);
        v += ((-k * (x - 1) - c * v) / m) * h;
        x += v * h; dt -= h;
      }
      onUpdate(x);
      if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.001) { onUpdate(1); return res(); }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export function initReveal() {
  const els = [...document.querySelectorAll('[data-reveal]')];
  if (reduced() || !('IntersectionObserver' in window)) return els.forEach((e) => (e.style.opacity = 1));
  const idx = new Map();
  document.querySelectorAll('[data-stagger]').forEach((p) =>
    [...p.querySelectorAll(':scope > [data-reveal]')].forEach((e, i) => idx.set(e, i)));
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target; io.unobserve(el);
      spring((p) => {
        el.style.opacity = clamp(p, 0, 1);
        el.style.transform = `translate3d(0,${(1 - p) * 28}px,0)`;
      }, { delay: (idx.get(el) || 0) * 70 }).then(() => { el.style.transform = ''; });
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  els.forEach((e) => io.observe(e));
}

// Smooth wheel scrolling: lerp 0.085 (value read from the studied reference's Lenis config),
// anchors offset by the sticky header. Touch stays native. Reduced motion: native scroll.
export function initSmoothScroll() {
  if (reduced() || matchMedia('(pointer: coarse)').matches) return;
  const LERP = 0.085;
  let target = scrollY, cur = scrollY, raf = 0, last = 0;
  const max = () => document.documentElement.scrollHeight - innerHeight;
  const go = (y) => scrollTo({ top: y, behavior: 'instant' });
  const tick = (t) => {
    const dt = Math.min(64, t - last) || 16.667; last = t;
    cur += (target - cur) * (1 - Math.pow(1 - LERP, dt / 16.667));
    if (Math.abs(target - cur) < 0.5) { cur = target; go(cur); raf = 0; return; }
    go(cur); raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); } };
  const nested = (el) => { for (; el instanceof Element && el !== document.body; el = el.parentElement) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight) return true; } return false; };
  addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.defaultPrevented || nested(e.target)) return;
    e.preventDefault();
    if (!raf) { cur = target = scrollY; }
    target = clamp(target + e.deltaY * (e.deltaMode === 1 ? 32 : 1), 0, max()); start();
  }, { passive: false });
  addEventListener('scroll', () => { if (!raf) cur = target = scrollY; }, { passive: true });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    const el = document.querySelector(a.getAttribute('href')); if (!el) return;
    e.preventDefault();
    const off = (document.querySelector('.top')?.offsetHeight || 0) + 12;
    cur = scrollY; target = clamp(el.getBoundingClientRect().top + scrollY - off, 0, max()); start();
  });
}

export function initSpotlight() {
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-spot]');
    if (!t) return;
    const r = t.getBoundingClientRect();
    t.style.setProperty('--mx', e.clientX - r.left + 'px');
    t.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}

export function initProgress(bar) {
  let q = false;
  const upd = () => {
    q = false;
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? clamp(scrollY / h, 0, 1) : 0})`;
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(upd); } }, { passive: true });
  addEventListener('resize', upd); upd();
}

export function initParallax(hero) {
  const layers = [...hero.querySelectorAll('[data-depth]')];
  if (reduced() || !layers.length) return;
  let px = 0, py = 0, tx = 0, ty = 0, sy = 0, run = false;
  const tick = () => {
    px += (tx - px) * 0.08; py += (ty - py) * 0.08;
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth);
      l.style.transform = `translate3d(${px * d * 26}px,${py * d * 18 + sy * d * 60}px,0)`;
    });
    if (Math.abs(tx - px) > 0.001 || Math.abs(ty - py) > 0.001 || run) { run = false; requestAnimationFrame(tick); } else running = false;
  };
  let running = false;
  const kick = () => { if (!running) { running = true; requestAnimationFrame(tick); } };
  hero.addEventListener('pointermove', (e) => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2; ty = ((e.clientY - r.top) / r.height - 0.5) * 2; kick();
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; kick(); });
  addEventListener('scroll', () => {
    const r = hero.getBoundingClientRect();
    sy = clamp(-r.top / Math.max(1, r.height), -1, 1); run = true; kick();
  }, { passive: true });
}

// Gradient mesh: drifting radial blobs sampled from CSS tokens at runtime.
export function initMesh(canvas) {
  const ctx = canvas.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const col = (n) => cs.getPropertyValue(n).trim();
  const blobs = [
    { c: col('--navy'), x: 0.2, y: 0.3, r: 0.7, sx: 0.00017, sy: 0.00021, a: 0.95 },
    { c: col('--cyan'), x: 0.82, y: 0.25, r: 0.42, sx: 0.00023, sy: 0.00015, a: 0.22 },
    { c: col('--glow'), x: 0.6, y: 0.85, r: 0.55, sx: 0.00013, sy: 0.00027, a: 0.26 },
    { c: col('--navy'), x: 0.95, y: 0.8, r: 0.5, sx: 0.00019, sy: 0.00012, a: 0.7 },
  ];
  const base = col('--ink');
  let w = 0, h = 0, raf = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    w = canvas.width = Math.max(2, r.width * dpr); h = canvas.height = Math.max(2, r.height * dpr);
  };
  const draw = (t) => {
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    blobs.forEach((b, i) => {
      const x = (b.x + Math.sin(t * b.sx + i) * 0.14) * w, y = (b.y + Math.cos(t * b.sy + i * 2) * 0.16) * h;
      const R = b.r * Math.max(w, h) * 0.8;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R);
      g.addColorStop(0, b.c); g.addColorStop(1, 'transparent');
      ctx.globalAlpha = b.a; ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
    ctx.globalAlpha = 1;
  };
  const loop = (t) => { draw(t); raf = requestAnimationFrame(loop); };
  const start = () => { cancelAnimationFrame(raf); size(); if (reduced()) draw(4000); else raf = requestAnimationFrame(loop); };
  addEventListener('resize', start);
  mq.addEventListener && mq.addEventListener('change', start);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelAnimationFrame(raf); else start(); });
  start();
}

// Number count-up with flash on change.
const store = new WeakMap();
export function setNum(el, value, fmt, { flash = true, dur = 700 } = {}) {
  const prev = store.get(el);
  store.set(el, value);
  const ok = typeof value === 'number' && Number.isFinite(value);
  if (!ok || prev === undefined || typeof prev !== 'number' || prev === value || reduced()) {
    el.textContent = fmt(value);
    if (flash && prev !== undefined && prev !== value && !reduced()) doFlash(el);
    return;
  }
  const from = prev, t0 = performance.now();
  const cancelKey = (el._cu = (el._cu || 0) + 1);
  const step = (now) => {
    if (el._cu !== cancelKey) return;
    const p = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(from + (value - from) * e);
    if (p < 1) requestAnimationFrame(step); else el.textContent = fmt(value);
  };
  requestAnimationFrame(step);
  if (flash) doFlash(el);
}
function doFlash(el) {
  const host = el.closest('.c') || el;
  host.classList.remove('flash'); void host.offsetWidth; host.classList.add('flash');
}
