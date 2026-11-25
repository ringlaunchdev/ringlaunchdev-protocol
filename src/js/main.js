import { register, linkOf, handleOf, isStated } from './register.js';
import { initCA } from './ca.js';
import { runGateScan } from './gates.js';
import { initReveal, initSpotlight, initSmoothScroll, initProgress, initParallax, initMesh } from './fx.js';
import { createMarket } from './market.js';
import { createOwn } from './own.js';
import { createBoard } from './board.js';

document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// Socials: derive from the register. No href for unstated records.
$$('[data-social]').forEach((a) => {
  const rec = register[a.dataset.social];
  const url = linkOf(rec);
  const handle = handleOf(rec);
  const name = a.dataset.social === 'x' ? 'X' : 'GitHub';
  if (url) {
    a.setAttribute('href', url); a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noreferrer noopener');
    a.setAttribute('aria-label', name + ' ' + handle); a.setAttribute('title', handle); a.removeAttribute('aria-disabled');
  } else {
    a.removeAttribute('href'); a.setAttribute('aria-disabled', 'true'); a.setAttribute('role', 'img');
    a.setAttribute('aria-label', name + ' (not available yet)'); a.setAttribute('title', name + ' (not available yet)');
  }
});
$$('[data-ca-action]').forEach((b) => {
  const live = isStated(register.ca);
  b.disabled = !live; b.textContent = live ? 'Copy contract' : 'Contract pending';
  if (live) b.addEventListener('click', () => $('[data-ca]').click());
});

initCA();
initSpotlight();
initSmoothScroll();
initProgress($('#progress'));
initParallax($('#hero'));
initMesh($('#mesh'));

const brand = $('[data-brand-logo]').getAttribute('src');
const board = createBoard({
  rows: $('#rows'), tape: $('#tape'), err: $('#board-err'), count: $('#board-count'),
  pills: $$('[data-pill-host]'), tabs: $$('[data-tab]'), chips: $$('[data-pill]'),
}, brand);

createOwn(brand, (v) => board.setOwn(v)).start();
createMarket((m) => board.setMarket(m)).start();

initReveal();
runGateScan();
