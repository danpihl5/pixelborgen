// Draws the game state in isometric pixel art and turns taps, drags and pinches into actions.
// All rules live in src/game; this scene only reads the state and plays the effects.

import Phaser from 'phaser';
import { play } from '../audio';
import type { Enemy, GameEvent } from '../game/game';
import { towerStats } from '../game/game';
import { TILE_H, TILE_W, depthOf, tileAt, toScreen } from '../iso';
import { PAL } from '../art/pixels';
import {
  drawBush, drawCastle, drawGround, drawRock, drawTent, drawTowerBue, drawTowerFrost, drawTowerKanon, drawTree, enemyArts,
  type SpriteArt,
} from '../art/textures';
import type { Session } from '../session';

const GROUND_DEPTH_LAYER = -10000;
const SELECTION_LAYER = -5000;
const FX_LAYER = 10000;
const TEXT_LAYER = 20000;
/** Height in pixels of a tower's firing point above its tile. */
const MUZZLE = 30;
const DRAG_START = 8;
const MAX_ZOOM = 5;

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: number }

const hex = (c: string) => parseInt(c.slice(1), 16);

export class WorldScene extends Phaser.Scene {
  private session: Session;
  private art = new Map<string, SpriteArt>();
  private towerSprites = new Map<number, Phaser.GameObjects.Image>();
  private enemySprites = new Map<number, Phaser.GameObjects.Image>();
  private flashUntil = new Map<number, number>();
  private recoilUntil = new Map<number, number>();
  private particles: Particle[] = [];
  private selGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private game0 = null as Session['game'] | null;
  private clock = 0;

  private minZoom = 1;
  private worldBounds = new Phaser.Geom.Rectangle();
  private drag = { active: false, moved: false, x: 0, y: 0 };
  private pinch: { dist: number; zoom: number } | null = null;

  constructor(session: Session) {
    super('world');
    this.session = session;
  }

  create(): void {
    const level = this.session.game.level;

    // Textures
    const ground = drawGround(level);
    this.textures.addCanvas('ground', ground.canvas);
    const register = (key: string, a: SpriteArt) => {
      this.art.set(key, a);
      this.textures.addCanvas(key, a.canvas);
    };
    register('bue', drawTowerBue());
    register('kanon', drawTowerKanon());
    register('frost', drawTowerFrost());
    register('castle', drawCastle());
    register('rock', drawRock());
    register('bush', drawBush());
    register('tent', drawTent());
    for (let i = 0; i < 4; i++) register(`tree${i}`, drawTree(i));
    for (const [key, a] of Object.entries(enemyArts())) register(key, a);

    this.add.image(-ground.ox, ground.oy, 'ground').setOrigin(0, 0).setDepth(GROUND_DEPTH_LAYER);

    // Scenery
    let treeN = 0;
    level.tiles.forEach((row, r) => row.forEach((tile, c) => {
      if (tile === 'tree') this.placeStatic(`tree${[0, 3, 1, 0, 2, 3][treeN++ % 6]}`, c, r, 2);
      else if (tile === 'rock') this.placeStatic('rock', c, r, 0);
      else if (tile === 'bush') this.placeStatic('bush', c, r, 1);
      else if (tile === 'castle') this.placeStatic('castle', c, r, 0, 0.6);
      else if (tile === 'spawn') this.placeStatic('tent', c, r, 0, 0.6);
    }));

    this.selGfx = this.add.graphics().setDepth(SELECTION_LAYER);
    this.fxGfx = this.add.graphics().setDepth(FX_LAYER);

    // Camera
    const pad = 24;
    this.worldBounds.setTo(-ground.ox - pad, -48, ground.canvas.width + pad * 2, ground.canvas.height + 48 + pad);
    this.fitCamera(true);
    this.scale.on('resize', () => this.fitCamera(false));

    this.setupInput();
    this.game0 = this.session.game;
  }

  // ---------- Camera ----------

  private fitCamera(initial: boolean): void {
    const cam = this.cameras.main;
    const b = this.worldBounds;
    const fit = Math.min(cam.width / b.width, cam.height / b.height);
    this.minZoom = Math.max(0.25, fit);
    if (initial) {
      // Start a little closer than "whole map" so tiles are big enough to tap on a phone.
      cam.setZoom(Phaser.Math.Clamp(fit * 1.15, this.minZoom, MAX_ZOOM));
      this.applyBounds();
      cam.centerOn(b.centerX, b.centerY);
    } else {
      cam.setZoom(Phaser.Math.Clamp(cam.zoom, this.minZoom, MAX_ZOOM));
      this.applyBounds();
    }
  }

  /** Keeps the map on screen; when it is smaller than the view, it stays centred. */
  private applyBounds(): void {
    const cam = this.cameras.main;
    const b = this.worldBounds;
    const w = Math.max(b.width, cam.width / cam.zoom);
    const h = Math.max(b.height, cam.height / cam.zoom);
    cam.setBounds(b.centerX - w / 2, b.centerY - h / 2, w, h);
  }

  /** Screen pixel to world pixel, without waiting for the camera matrix to refresh. */
  private toWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    return {
      x: cam.scrollX + cam.width / 2 + (sx - cam.width / 2) / cam.zoom,
      y: cam.scrollY + cam.height / 2 + (sy - cam.height / 2) / cam.zoom,
    };
  }

  private zoomAt(zoom: number, sx: number, sy: number): void {
    const cam = this.cameras.main;
    const before = this.toWorld(sx, sy);
    cam.setZoom(Phaser.Math.Clamp(zoom, this.minZoom, MAX_ZOOM));
    this.applyBounds();
    const after = this.toWorld(sx, sy);
    cam.scrollX += before.x - after.x;
    cam.scrollY += before.y - after.y;
  }

  private setupInput(): void {
    this.input.addPointer(1);
    const pointers = () => [this.input.pointer1, this.input.pointer2].filter((p) => p.isDown);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const down = pointers();
      if (down.length >= 2) {
        const [a, b] = down;
        this.pinch = { dist: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), zoom: this.cameras.main.zoom };
        this.drag.moved = true; // a pinch is never a tap
        return;
      }
      this.drag = { active: true, moved: false, x: p.x, y: p.y };
    });

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const down = pointers();
      if (this.pinch && down.length >= 2) {
        const [a, b] = down;
        const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.zoomAt(this.pinch.zoom * (dist / Math.max(1, this.pinch.dist)), (a.x + b.x) / 2, (a.y + b.y) / 2);
        return;
      }
      if (!this.drag.active || !p.isDown) return;
      if (!this.drag.moved && Phaser.Math.Distance.Between(p.x, p.y, this.drag.x, this.drag.y) > DRAG_START) this.drag.moved = true;
      if (this.drag.moved) {
        const cam = this.cameras.main;
        cam.scrollX -= (p.x - p.prevPosition.x) / cam.zoom;
        cam.scrollY -= (p.y - p.prevPosition.y) / cam.zoom;
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (pointers().length === 0) this.pinch = null;
      if (!this.drag.active) return;
      const wasTap = !this.drag.moved;
      this.drag.active = pointers().length > 0;
      if (wasTap) this.tap(p.x, p.y);
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(this.cameras.main.zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y);
    });
  }

  private tap(sx: number, sy: number): void {
    const w = this.toWorld(sx, sy);
    // Towers stand up out of their tile, so check their bodies first, nearest to the camera first.
    const towers = [...this.session.game.towers].sort((a, b) => depthOf(b.x, b.y) - depthOf(a.x, a.y));
    for (const t of towers) {
      const p = toScreen(t.x, t.y);
      if (Math.abs(w.x - p.x) <= 12 && w.y >= p.y - 38 && w.y <= p.y + 8) return this.session.tapTower(t);
    }
    const { c, r } = tileAt(w.x, w.y);
    this.session.tapTile(c, r);
  }

  // ---------- Frame ----------

  update(_time: number, delta: number): void {
    const s = this.session;
    if (this.game0 !== s.game) this.resetEntities();
    const dt = Math.min(delta / 1000, 0.05);
    if (s.running) {
      for (let i = 0; i < s.speed && !s.game.over; i++) s.game.update(dt);
      this.clock += dt * s.speed;
    } else if (!s.started) {
      this.clock += dt;
    }
    for (const e of s.game.drainEvents()) {
      this.effect(e);
      s.dispatch(e);
    }
    this.updateParticles(s.running ? dt * s.speed : 0);
    this.syncTowers();
    this.syncEnemies();
    this.drawSelection();
    this.drawFx();
  }

  private resetEntities(): void {
    this.towerSprites.forEach((s) => s.destroy());
    this.enemySprites.forEach((s) => s.destroy());
    this.towerSprites.clear();
    this.enemySprites.clear();
    this.flashUntil.clear();
    this.recoilUntil.clear();
    this.particles = [];
    this.game0 = this.session.game;
  }

  private placeStatic(key: string, c: number, r: number, dy: number, depthBias = 0.5): void {
    const a = this.art.get(key)!;
    const p = toScreen(c + 0.5, r + 0.5);
    this.add.image(p.x, p.y + dy, key)
      .setOrigin(a.fx / a.canvas.width, a.fy / a.canvas.height)
      .setDepth(depthOf(c + 0.5, r + 0.5) + depthBias);
  }

  private syncTowers(): void {
    const game = this.session.game;
    const alive = new Set<number>();
    for (const t of game.towers) {
      alive.add(t.id);
      let img = this.towerSprites.get(t.id);
      if (!img || img.texture.key !== t.type) {
        img?.destroy();
        const a = this.art.get(t.type)!;
        img = this.add.image(0, 0, t.type).setOrigin(a.fx / a.canvas.width, a.fy / a.canvas.height);
        this.towerSprites.set(t.id, img);
      }
      const p = toScreen(t.x, t.y);
      const recoil = (this.recoilUntil.get(t.id) ?? 0) > this.clock ? 1 : 0;
      img.setPosition(p.x, p.y + recoil).setDepth(depthOf(t.x, t.y) + 0.5);
    }
    for (const [id, img] of this.towerSprites) if (!alive.has(id)) { img.destroy(); this.towerSprites.delete(id); }
  }

  /** Which sprite to show, mirrored or not, and how far above the ground it floats. */
  private enemyLook(e: Enemy): { key: string; flip: boolean; lift: number; scale: number } {
    const front = e.dx > 0.5 || e.dy > 0.5;
    const flip = e.dy > 0.5 || e.dx < -0.5;
    const flying = e.type === 'raven';
    const frame = Math.floor(this.clock * (flying ? 8 : e.type === 'ogre' ? 3 : 5) + e.id * 0.37) % 2;
    const key = `${e.type}-${front ? 'front' : 'back'}-${frame}`;
    const lift = flying ? 11 + frame : frame;
    return { key, flip, lift, scale: e.type === 'ogre' ? 2 : 1 };
  }

  private syncEnemies(): void {
    const alive = new Set<number>();
    for (const e of this.session.game.enemies) {
      alive.add(e.id);
      const { key, flip, lift, scale } = this.enemyLook(e);
      let img = this.enemySprites.get(e.id);
      if (!img) {
        img = this.add.image(0, 0, key).setScale(scale);
        this.enemySprites.set(e.id, img);
      }
      const a = this.art.get(key)!;
      // Mirroring flips around the origin, so mirror the foot point too.
      const fx = flip ? a.canvas.width - a.fx : a.fx;
      img.setTexture(key).setOrigin(fx / a.canvas.width, a.fy / a.canvas.height).setFlipX(flip);
      const p = toScreen(e.x, e.y);
      img.setPosition(Math.round(p.x), Math.round(p.y + 2 - lift)).setDepth(depthOf(e.x, e.y) + 0.4);
      if ((this.flashUntil.get(e.id) ?? 0) > this.clock) img.setTintFill(0xffffff);
      else if (e.slowTime > 0) img.setTint(hex(PAL.ice));
      else img.clearTint();
    }
    for (const [id, img] of this.enemySprites) {
      if (!alive.has(id)) { img.destroy(); this.enemySprites.delete(id); this.flashUntil.delete(id); }
    }
  }

  // ---------- Overlays ----------

  private drawSelection(): void {
    const g = this.selGfx;
    g.clear();
    const sel = this.session.selection;
    if (!sel) return;
    const c = sel.kind === 'tower' ? sel.tower.c : sel.c;
    const r = sel.kind === 'tower' ? sel.tower.r : sel.r;
    if (sel.kind === 'tower') {
      const range = towerStats(sel.tower.type, sel.tower.level).range;
      const p = toScreen(c + 0.5, r + 0.5);
      const rx = range * (TILE_W / 2) * Math.SQRT2;
      const ry = range * (TILE_H / 2) * Math.SQRT2;
      g.fillStyle(hex(PAL.white), 0.14).fillEllipse(p.x, p.y, rx * 2, ry * 2, 48);
      g.lineStyle(1, hex(PAL.white), 0.6).strokeEllipse(p.x, p.y, rx * 2, ry * 2, 48);
    }
    if (Math.floor(this.clock * 3) % 2 === 0 || sel.kind === 'tower') {
      const a = toScreen(c, r), b = toScreen(c + 1, r), d = toScreen(c + 1, r + 1), e = toScreen(c, r + 1);
      g.lineStyle(1, hex(sel.kind === 'tile' ? PAL.white : PAL.gold), 1);
      g.strokePoints([a, b, d, e], true);
    }
  }

  private drawFx(): void {
    const g = this.fxGfx;
    const game = this.session.game;
    g.clear();

    // Shadows under flying enemies, health bars and tower level pips.
    for (const e of game.enemies) {
      const p = toScreen(e.x, e.y);
      const look = this.enemyLook(e);
      if (e.type === 'raven') g.fillStyle(hex(PAL.outline), 0.3).fillRect(Math.round(p.x - 4), Math.round(p.y + 1), 8, 2);
      if (e.hp < e.maxHp) {
        const a = this.art.get(look.key)!;
        const top = a.fy * look.scale + look.lift + 1;
        const w = e.type === 'ogre' ? 20 : 12;
        const x = Math.round(p.x - w / 2);
        const y = Math.round(p.y - top);
        const f = Math.max(0, e.hp / e.maxHp);
        g.fillStyle(hex(PAL.outline), 1).fillRect(x - 1, y - 1, w + 2, 3);
        g.fillStyle(hex(f < 0.3 ? PAL.red1 : PAL.grass1), 1).fillRect(x, y, Math.max(1, Math.round(w * f)), 1);
      }
    }
    for (const t of game.towers) {
      const p = toScreen(t.x, t.y);
      const x0 = Math.round(p.x - (t.level * 3 - 1) / 2);
      g.fillStyle(hex(PAL.outline), 1).fillRect(x0 - 1, p.y + 8, t.level * 3 + 1, 3);
      g.fillStyle(hex(PAL.gold), 1);
      for (let i = 0; i < t.level; i++) g.fillRect(x0 + i * 3, p.y + 9, 2, 1);
    }

    // Projectiles arc from the tower top down to the enemy.
    for (const s of game.shots) {
      const p = toScreen(s.x, s.y);
      const h = MUZZLE * (1 - s.progress) + 6 * s.progress + (s.type === 'kanon' ? Math.sin(s.progress * Math.PI) * 14 : 0);
      const x = Math.round(p.x);
      const y = Math.round(p.y - h);
      if (s.type === 'bue') {
        const t = toScreen(s.tx, s.ty);
        const ang = Math.atan2(t.y - 6 - y, t.x - x);
        g.fillStyle(hex(PAL.wood1), 1);
        for (let i = 1; i <= 3; i++) g.fillRect(Math.round(x - Math.cos(ang) * i), Math.round(y - Math.sin(ang) * i), 1, 1);
        g.fillStyle(hex(PAL.white), 1).fillRect(x, y, 1, 1);
      } else if (s.type === 'kanon') {
        g.fillStyle(hex(PAL.outline), 1).fillRect(x - 2, y - 2, 5, 5);
        g.fillStyle(hex(PAL.rock1), 1).fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle(hex(PAL.stone1), 1).fillRect(x - 1, y - 1, 1, 1);
      } else {
        g.fillStyle(hex(PAL.blue2), 1).fillRect(x - 1, y - 1, 3, 3);
        g.fillStyle(hex(PAL.magic), 1).fillRect(x, y - 2, 1, 5).fillRect(x - 2, y, 5, 1);
        g.fillStyle(hex(PAL.white), 1).fillRect(x, y, 1, 1);
      }
    }

    for (const q of this.particles) {
      g.fillStyle(q.color, 1).fillRect(Math.round(q.x), Math.round(q.y - q.z), 1, 1);
    }
  }

  // ---------- Effects ----------

  private burst(x: number, y: number, z: number, color: string, n: number, speed: number, gravity = true): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5,
        vz: gravity ? 20 + Math.random() * 30 : (Math.random() - 0.5) * 20,
        life: 0.3 + Math.random() * 0.35, color: hex(color),
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const q of this.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vz -= 120 * dt;
      if (q.z < 0) { q.z = 0; q.vz = 0; q.vx *= 0.5; q.vy *= 0.5; }
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  private popup(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: '"Press Start 2P", monospace', fontSize: '8px', color: PAL.gold,
      stroke: PAL.outline, strokeThickness: 2,
    }).setOrigin(0.5, 1).setDepth(TEXT_LAYER);
    this.tweens.add({ targets: t, y: y - 14, alpha: 0, duration: 900, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  private effect(e: GameEvent): void {
    switch (e.type) {
      case 'shoot':
        this.recoilUntil.set(e.tower.id, this.clock + 0.1);
        play(e.tower.type);
        break;
      case 'hit': {
        const p = toScreen(e.shot.x, e.shot.y);
        if (e.shot.type === 'kanon') { this.burst(p.x, p.y, 4, PAL.rock1, 10, 35); this.burst(p.x, p.y, 4, PAL.dirt1, 8, 25); }
        else if (e.shot.type === 'frost') this.burst(p.x, p.y, 6, PAL.magic, 8, 25, false);
        else this.burst(p.x, p.y, 6, PAL.white, 2, 15);
        break;
      }
      case 'damage':
        this.flashUntil.set(e.enemy.id, this.clock + 0.06);
        break;
      case 'kill': {
        const p = toScreen(e.enemy.x, e.enemy.y);
        // A cartoon poof of dust, a few bits of the enemy and some gold.
        const color = { peasant: PAL.red2, raven: PAL.raven1, knight: PAL.metal2, ogre: PAL.ogre1 }[e.enemy.type];
        const big = e.enemy.type === 'ogre';
        this.burst(p.x, p.y, 8, PAL.white, big ? 24 : 10, 22, false);
        this.burst(p.x, p.y, 8, color, big ? 20 : 6, 35);
        this.burst(p.x, p.y, 8, PAL.gold, big ? 12 : 4, 30);
        this.popup(p.x, p.y - 14, `+${e.enemy.reward}`);
        play('pop');
        break;
      }
      case 'leak':
        this.cameras.main.shake(200, 0.006);
        play('hurt');
        break;
      case 'build': case 'upgrade': {
        const p = toScreen(e.tower.x, e.tower.y);
        this.burst(p.x, p.y, 2, e.type === 'build' ? PAL.dirt1 : PAL.gold, 10, 30);
        play('build');
        break;
      }
      case 'sell': {
        const p = toScreen(e.tower.x, e.tower.y);
        this.burst(p.x, p.y, 4, PAL.stone2, 12, 30);
        play('sell');
        break;
      }
      case 'waveStart': play('wave'); break;
      case 'waveCleared': play('clear'); break;
      case 'gameOver': play('over'); break;
    }
  }
}
