// The HTML around the map: a title bar on top and, at the bottom, a tray that says what to
// do next and holds the buttons. Plain DOM keeps text crisp and buttons easy to tap.

import { isMuted, setMuted, unlock } from '../audio';
import { BUILDINGS } from '../game/city';
import type { Session } from '../session';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export function setupHud(session: Session): void {
  const tray = $('tray'), toastEl = $('toast'), soundBtn = $('soundBtn');

  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2200);
  };

  const render = () => {
    const { city, plan } = session;
    if (city.phase === 'build') {
      tray.innerHTML = `<p class="step">DIT SLOT ER KLAR</p>
        <p class="tip">Mere kommer snart.</p>`;
    } else if (!plan) {
      tray.innerHTML = `<p class="step">PLACER DIT SLOT</p>
        <p class="tip">Tryk på græsset, hvor slottet skal stå. Træk for at flytte kortet, og knib for at zoome.</p>`;
    } else {
      const d = BUILDINGS[plan.type];
      const ok = session.planValid;
      tray.innerHTML = `<p class="step">PLACER DIT SLOT</p>
        <p class="tip">${ok ? `Slottet fylder ${d.w} × ${d.h} felter. Tryk et andet sted for at flytte det.` : 'Slottet skal stå på frit græs, helt inde på kortet.'}</p>
        <div class="actions">
          <button class="btn go big" type="button" data-act="confirm" ${ok ? '' : 'disabled'}>BYG SLOT HER</button>
          <button class="btn" type="button" data-act="cancel">FORTRYD</button>
        </div>`;
    }
  };

  tray.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    unlock();
    if (btn.dataset.act === 'confirm') session.confirmPlan();
    else if (btn.dataset.act === 'cancel') session.cancelPlan();
  });

  session.onChange(render);
  session.onPlaced(() => toast('SLOTTET ER BYGGET!'));
  render();

  const renderSound = () => {
    soundBtn.classList.toggle('off', isMuted());
    soundBtn.setAttribute('aria-pressed', String(!isMuted()));
  };
  soundBtn.addEventListener('click', () => {
    setMuted(!isMuted());
    unlock();
    renderSound();
  });
  renderSound();
  // Browsers only allow sound after the first touch.
  document.addEventListener('pointerdown', unlock, { once: true });
}
