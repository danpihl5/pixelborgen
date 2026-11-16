// The HTML around the map: a title bar on top and, at the bottom, a tray that says what to
// do next and holds the build menu. Plain DOM keeps text crisp and buttons easy to tap.

import { BUILDING_IMAGES } from '../art/buildings';
import { isMuted, setMuted, unlock } from '../audio';
import { BUILDABLE, BUILDINGS, type BuildingType } from '../game/city';
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
    const { city, plan, selected } = session;
    if (!selected) {
      tray.innerHTML = `<p class="step">BYG</p>
        <div class="build-grid">${BUILDABLE.map((type) => {
          const d = BUILDINGS[type];
          return `<button class="opt" type="button" data-act="select" data-type="${type}">
            <img src="${BUILDING_IMAGES[type]}" alt=""><span class="name">${d.name}</span>
            <span class="size">${d.w} × ${d.h} felter</span></button>`;
        }).join('')}</div>`;
      return;
    }
    const d = BUILDINGS[selected];
    const name = d.name.toLowerCase();
    const first = city.phase === 'placeCastle';
    const title = first ? 'PLACER DIT SLOT' : `BYG ${d.name.toUpperCase()}`;
    if (!plan) {
      tray.innerHTML = `<p class="step">${title}</p>
        <p class="tip">Tryk på græsset, hvor ${first ? 'slottet' : name} skal stå.${first ? ' Træk for at flytte kortet, og knib for at zoome.' : ''}</p>
        ${first ? '' : '<div class="actions"><button class="btn" type="button" data-act="cancel">FORTRYD</button></div>'}`;
    } else {
      const ok = session.planValid;
      tray.innerHTML = `<p class="step">${title}</p>
        <p class="tip">${ok ? `Fylder ${d.w} × ${d.h} felter. Tryk et andet sted for at flytte.` : 'Der skal være frit græs under hele bygningen.'}</p>
        <div class="actions">
          <button class="btn go big" type="button" data-act="confirm" ${ok ? '' : 'disabled'}>BYG HER</button>
          <button class="btn" type="button" data-act="cancel">FORTRYD</button>
        </div>`;
    }
  };

  tray.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    unlock();
    const act = btn.dataset.act;
    if (act === 'confirm') session.confirmPlan();
    else if (act === 'cancel') session.cancelPlan();
    else if (act === 'select') session.select(btn.dataset.type as BuildingType);
  });

  session.onChange(render);
  session.onPlaced((b) => toast(`${BUILDINGS[b.type].name.toUpperCase()} ER BYGGET!`));
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
