// The HTML around the map: stats on top, build tray and wave button at the bottom, overlays.
// Plain DOM keeps text crisp and buttons easy to tap on every screen size.

import { isMuted, setMuted, unlock } from '../audio';
import { drawCoin, drawHeart, drawTowerBue, drawTowerFrost, drawTowerKanon } from '../art/textures';
import { MAX_LEVEL, TOWER_TYPES, TOWERS, type TowerType } from '../game/data';
import { towerStats } from '../game/game';
import { isBossWave } from '../game/waves';
import type { Session } from '../session';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const ICONS: Record<TowerType, string> = {
  bue: drawTowerBue().canvas.toDataURL(),
  kanon: drawTowerKanon().canvas.toDataURL(),
  frost: drawTowerFrost().canvas.toDataURL(),
};

const fmt = (n: number) => n.toFixed(1).replace('.', ',');
const waves = (n: number) => `${n} ${n === 1 ? 'bølge' : 'bølger'}`;

export function setupHud(session: Session): void {
  const lives = $('lives'), gold = $('gold'), wave = $('wave');
  const ctx = $('ctx'), toastEl = $('toast');
  const waveBtn = $<HTMLButtonElement>('waveBtn'), speedBtn = $('speedBtn');
  const soundBtn = $('soundBtn'), pauseBtn = $('pauseBtn');
  const startOv = $('startOv'), overOv = $('overOv');

  document.querySelector<HTMLElement>('.icon.heart')!.style.backgroundImage = `url(${drawHeart().toDataURL()})`;
  document.querySelector<HTMLElement>('.icon.coin')!.style.backgroundImage = `url(${drawCoin().toDataURL()})`;

  const bestText = () => (session.best > 0 ? `Din rekord: ${waves(session.best)}` : '');
  $('bestStart').textContent = bestText();

  let toastTimer = 0;
  const toast = (msg: string) => {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 1900);
  };

  // ---------- Tray ----------
  const refreshAfford = () => {
    ctx.querySelectorAll<HTMLButtonElement>('[data-cost]').forEach((b) => {
      b.disabled = session.game.gold < Number(b.dataset.cost);
    });
  };

  const renderTray = () => {
    const { game, selection: sel } = session;
    if (game.over) {
      ctx.innerHTML = '<p class="tip">Borgen er faldet.</p>';
    } else if (!sel) {
      ctx.innerHTML = '<p class="tip">Tryk på græsset for at bygge et tårn. Tryk på et tårn for at opgradere det.</p>';
    } else if (sel.kind === 'tile') {
      ctx.innerHTML = `<div class="build-grid">${TOWER_TYPES.map((k) => {
        const b = TOWERS[k];
        return `<button class="opt" type="button" data-act="build" data-type="${k}" data-cost="${b.cost}">
          <img src="${ICONS[k]}" alt=""><span>${b.name.toUpperCase()}</span>
          <span class="price">${b.cost}</span><span class="desc">${b.desc}</span></button>`;
      }).join('')}</div>`;
    } else {
      const t = sel.tower;
      const st = towerStats(t.type, t.level);
      const cost = game.upgradeCost(t);
      const extra = st.slow ? ' · bremser 50 %' : st.splash ? ' · rammer flere' : '';
      ctx.innerHTML = `<div class="tinfo">
        <img src="${ICONS[t.type]}" alt="">
        <div><div class="tname">${TOWERS[t.type].name.toUpperCase()} · NIV. ${t.level}</div>
        <div class="tstats">Skade ${st.dmg} · Rækkevidde ${fmt(st.range)} · ${fmt(1 / st.rate)} skud/s${extra}</div></div>
        <div class="tbtns">
          ${t.level < MAX_LEVEL
            ? `<button class="btn" type="button" data-act="up" data-cost="${cost}">OPGRADER ${cost}</button>`
            : '<button class="btn" type="button" disabled>MAKS NIVEAU</button>'}
          <button class="btn red" type="button" data-act="sell">SÆLG +${game.sellValue(t)}</button>
        </div></div>`;
    }
    refreshAfford();
  };

  ctx.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-act]');
    if (!btn || btn.disabled) return;
    unlock();
    const act = btn.dataset.act;
    if (act === 'build') session.build(btn.dataset.type as TowerType);
    else if (act === 'up') session.upgrade();
    else if (act === 'sell') session.sell();
  });

  session.onChange(renderTray);
  renderTray();

  // ---------- Events ----------
  session.onEvent((e) => {
    if (e.type === 'waveStart') toast(isBossWave(e.wave) ? `BØLGE ${e.wave}: KÆMPESLIM!` : `BØLGE ${e.wave}`);
    else if (e.type === 'waveCleared') toast(`BØLGE ${e.wave} KLARET! +${e.bonus}`);
    else if (e.type === 'gameOver') {
      $('overText').textContent = e.wavesCleared > 0
        ? `Du holdt stand i ${waves(e.wavesCleared)}.`
        : 'Monstrene kom ind i første bølge.';
      $('bestOver').textContent = bestText();
      overOv.hidden = false;
    }
  });

  // ---------- Buttons ----------
  $('playBtn').addEventListener('click', () => {
    unlock();
    session.started = true;
    startOv.hidden = true;
    toast('BYG ET TÅRN OG START BØLGEN');
  });
  $('againBtn').addEventListener('click', () => {
    unlock();
    overOv.hidden = true;
    session.restart();
    setPaused(false);
    toast('BYG ET TÅRN OG START BØLGEN');
  });
  waveBtn.addEventListener('click', () => {
    unlock();
    if (session.started) session.game.startWave();
  });
  speedBtn.addEventListener('click', () => {
    session.speed = (session.speed % 3) + 1;
    speedBtn.textContent = `${session.speed}X`;
  });

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

  const setPaused = (p: boolean) => {
    session.paused = p;
    pauseBtn.textContent = p ? '▶' : 'II';
    pauseBtn.setAttribute('aria-label', p ? 'Fortsæt' : 'Pause');
    if (p) toast('PAUSE');
  };
  pauseBtn.addEventListener('click', () => {
    if (session.started && !session.game.over) setPaused(!session.paused);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session.running) setPaused(true);
  });

  // ---------- Live numbers ----------
  const cache: Record<string, string> = {};
  const set = (el: HTMLElement, key: string, value: string) => {
    if (cache[key] === value) return false;
    cache[key] = value;
    el.textContent = value;
    return true;
  };
  const tick = () => {
    const g = session.game;
    set(lives, 'lives', String(g.lives));
    if (set(gold, 'gold', String(g.gold))) refreshAfford();
    set(wave, 'wave', String(g.wave));
    set(waveBtn, 'waveBtn', g.waveActive ? `BØLGE ${g.wave} I GANG` : `START BØLGE ${g.wave + 1}`);
    waveBtn.disabled = g.waveActive || g.over || !session.started;
    requestAnimationFrame(tick);
  };
  tick();
}
