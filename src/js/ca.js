import { register, isStated } from './register.js';

export function initCA() {
  const live = isStated(register.ca);
  document.querySelectorAll('[data-ca]').forEach((slot) => {
    const out = slot.querySelector('[data-ca-text]');
    const fb = slot.querySelector('[data-ca-feedback]');
    if (!live) {
      slot.setAttribute('data-state', 'absent');
      slot.setAttribute('aria-disabled', 'true');
      slot.removeAttribute('tabindex');
      slot.removeAttribute('role');
      return;
    }
    slot.setAttribute('data-state', 'stated');
    out.textContent = register.ca.value;
    slot.setAttribute('role', 'button');
    slot.setAttribute('tabindex', '0');
    slot.setAttribute('aria-disabled', 'false');
    slot.setAttribute('aria-label', 'Copy contract address ' + register.ca.value);
    const copy = async () => {
      try { await navigator.clipboard.writeText(register.ca.value); }
      catch {
        const t = document.createElement('textarea'); t.value = register.ca.value; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove();
      }
      slot.classList.add('copied'); if (fb) fb.textContent = 'Copied';
      clearTimeout(slot._t); slot._t = setTimeout(() => { slot.classList.remove('copied'); if (fb) fb.textContent = 'Copy'; }, 1600);
    };
    slot.addEventListener('click', copy);
    slot.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copy(); } });
  });
}
