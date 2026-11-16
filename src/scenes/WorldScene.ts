// Draws the city in isometric pixel art and turns taps, drags and pinches into actions.
// The rules live in src/game; this scene only reads the state and plays the effects.

import Phaser from 'phaser';
import { play } from '../audio';
import { BUILDINGS, type Building, type BuildingType } from '../game/city';
import { depthOf, toGrid, toScreen } from '../iso';
import { PAL } from '../art/pixels';
import { drawGround, drawRock, drawTree, type SpriteArt } from '../art/textures';
import type { Session } from '../session';

const GROUND_LAYER = -100000;
const GRID_LAYER = -90000;
const PLAN_LAYER = -50000;
const FX_LAYER = 100000;
const DRAG_START = 8;
const MAX_ZOOM = 3;
/** Zoom the game opens at: close enough to pick a spot with a finger. */
const START_ZOOM = 1;

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: number }

const hex = (c: string) => parseInt(c.slice(1), 16);

export class WorldScene extends Phaser.Scene {
  private session: Session;
  private buildingArt: Record<BuildingType, SpriteArt>;
  private art = new Map<string, SpriteArt>();
  private buildingSprites = new Map<number, Phaser.GameObjects.Image>();
  private ghost!: Phaser.GameObjects.Image;
  private gridGfx!: Phaser.GameObjects.Graphics;
  private planGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private particles: Particle[] = [];
  private clock = 0;

  private minZoom = 1;
  private worldBounds = new Phaser.Geom.Rectangle();
  private drag = { active: false, moved: false, x: 0, y: 0 };
  private pinch: { dist: number; zoom: number } | null = null;

  constructor(session: Session, buildingArt: Record<BuildingType, SpriteArt>) {
    super('world');
    this.session = session;
    this.buildingArt = buildingArt;
  }

  create(): void {
    const size = this.session.city.size;
    const ground = drawGround(size);
    this.textures.addCanvas('ground', ground.canvas);
    for (const [type, a] of Object.entries(this.buildingArt)) this.register(type, a);
    for (let i = 0; i < 4; i++) this.register(`tree${i}`, drawTree(i));
    for (let i = 0; i < 2; i++) this.register(`rock${i}`, drawRock(i));

    this.add.image(-ground.ox, ground.oy, 'ground').setOrigin(0, 0).setDepth(GROUND_LAYER);

    // Trees and rocks, with a little jitter so the woods don't look planted in rows.
    this.session.city.props.forEach((prop, i) => {
      const key = prop.kind === 'tree' ? `tree${(prop.c * 7 + prop.r * 3) % 4}` : `rock${i % 3 === 0 ? 1 : 0}`;
      const a = this.art.get(key)!;
      const jx = ((prop.c * 13 + prop.r * 7) % 9) - 4;
      const jy = ((prop.c * 5 + prop.r * 11) % 5) - 2;
      const p = toScreen(prop.c + 0.5, prop.r + 0.5);
      this.add.image(p.x + jx, p.y + jy, key)
        .setOrigin(a.fx / a.canvas.width, a.fy / a.canvas.height)
        .setDepth(depthOf(prop.c + 0.5, prop.r + 0.5));
    });
    // A faint tile grid, shown only while the player is placing a building.
    this.gridGfx = this.add.graphics().setDepth(GRID_LAYER).setVisible(false);
    this.gridGfx.lineStyle(1, hex(PAL.white), 0.22);
    for (let i = 0; i <= size; i++) {
      const a = toScreen(i, 0), b = toScreen(i, size), c = toScreen(0, i), d = toScreen(size, i);
      this.gridGfx.lineBetween(a.x, a.y, b.x, b.y).lineBetween(c.x, c.y, d.x, d.y);
    }
    this.planGfx = this.add.graphics().setDepth(PLAN_LAYER);
    this.fxGfx = this.add.graphics().setDepth(FX_LAYER);
    this.ghost = this.add.image(0, 0, 'castle').setAlpha(0.6).setVisible(false);

    const pad = 64;
    this.worldBounds.setTo(-ground.ox - pad, -180, ground.canvas.width + pad * 2, ground.canvas.height + 180 + pad);
    this.fitCamera(true);
    this.scale.on('resize', () => this.fitCamera(false));
    this.setupInput();

    this.session.onPlaced((b) => this.celebrate(b));
  }

  private register(key: string, a: SpriteArt): void {
    this.art.set(key, a);
    const texture = this.textures.addCanvas(key, a.canvas);
    if (a.smooth) texture?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  // ---------- Camera ----------

  private fitCamera(initial: boolean): void {
    const cam = this.cameras.main;
    const b = this.worldBounds;
    this.minZoom = Math.max(0.08, Math.min(cam.width / b.width, cam.height / b.height));
    if (initial) {
      cam.setZoom(Phaser.Math.Clamp(START_ZOOM, this.minZoom, MAX_ZOOM));
      this.applyBounds();
      const mid = toScreen(this.session.city.size / 2, this.session.city.size / 2);
      cam.centerOn(mid.x, mid.y);
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
      if (wasTap) {
        const w = this.toWorld(p.x, p.y);
        const g = toGrid(w.x, w.y);
        this.session.tapGround(g.x, g.y);
      }
    });

    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      this.zoomAt(this.cameras.main.zoom * (dy > 0 ? 0.85 : 1.18), p.x, p.y);
    });
  }

  // ---------- Frame ----------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.05);
    this.clock += dt;
    this.syncBuildings();
    this.drawPlan();
    this.updateParticles(dt);
    this.drawFx();
  }

  /** Where a building's sprite stands (the centre of its footprint) and its draw order. */
  private footOf(b: { type: Building['type']; c: number; r: number }): { x: number; y: number; depth: number } {
    const d = BUILDINGS[b.type];
    const p = toScreen(b.c + d.w / 2, b.r + d.h / 2);
    return { ...p, depth: depthOf(b.c + d.w / 2, b.r + d.h / 2) };
  }

  private syncBuildings(): void {
    for (const b of this.session.city.buildings) {
      if (this.buildingSprites.has(b.id)) continue;
      const a = this.art.get(b.type)!;
      const f = this.footOf(b);
      const img = this.add.image(f.x, f.y, b.type).setOrigin(a.fx / a.canvas.width, a.fy / a.canvas.height).setScale(a.scale ?? 1).setDepth(f.depth);
      this.buildingSprites.set(b.id, img);
    }
  }

  private drawPlan(): void {
    this.gridGfx.setVisible(this.session.selected !== null);
    const g = this.planGfx;
    g.clear();
    const plan = this.session.plan;
    this.ghost.setVisible(!!plan);
    if (!plan) return;
    const d = BUILDINGS[plan.type];
    const ok = this.session.planValid;
    const color = hex(ok ? PAL.grassLight : PAL.red1);
    const at = (x: number, y: number) => toScreen(plan.c + x, plan.r + y);

    // The footprint on the ground, pulsing gently, with its tiles marked out.
    const corners = [at(0, 0), at(d.w, 0), at(d.w, d.h), at(0, d.h)];
    g.fillStyle(color, 0.25 + 0.1 * Math.sin(this.clock * 5)).fillPoints(corners, true);
    g.lineStyle(2, color, 0.5);
    for (let i = 1; i < d.w; i++) g.lineBetween(at(i, 0).x, at(i, 0).y, at(i, d.h).x, at(i, d.h).y);
    for (let i = 1; i < d.h; i++) g.lineBetween(at(0, i).x, at(0, i).y, at(d.w, i).x, at(d.w, i).y);
    g.lineStyle(2, color, 1).strokePoints(corners, true);

    const f = this.footOf(plan);
    const a = this.art.get(plan.type)!;
    this.ghost.setTexture(plan.type).setOrigin(a.fx / a.canvas.width, a.fy / a.canvas.height).setScale(a.scale ?? 1);
    this.ghost.setPosition(f.x, f.y - 3 - Math.round(Math.abs(Math.sin(this.clock * 3)) * 4)).setDepth(f.depth + 0.01);
    if (ok) this.ghost.clearTint(); else this.ghost.setTint(hex(PAL.red1));
  }

  // ---------- Effects ----------

  private celebrate(b: Building): void {
    const d = BUILDINGS[b.type];
    for (let y = 0; y <= d.h; y++) {
      for (let x = 0; x <= d.w; x++) {
        const p = toScreen(b.c + x, b.r + y);
        this.burst(p.x, p.y, 4, PAL.dirt1, 8, 60);
        this.burst(p.x, p.y, 4, PAL.white, 5, 40, false);
      }
    }
    const mid = toScreen(b.c + d.w / 2, b.r + d.h / 2);
    this.burst(mid.x, mid.y, 90, PAL.gold, 40, 90);
    this.cameras.main.shake(180, 0.004);
    play('build');
  }

  private burst(x: number, y: number, z: number, color: string, n: number, speed: number, gravity = true): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.5,
        vz: gravity ? 40 + Math.random() * 60 : (Math.random() - 0.5) * 40,
        life: 0.4 + Math.random() * 0.5, color: hex(color),
      });
    }
  }

  private updateParticles(dt: number): void {
    for (const q of this.particles) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      q.vz -= 240 * dt;
      if (q.z < 0) { q.z = 0; q.vz = 0; q.vx *= 0.5; q.vy *= 0.5; }
      q.life -= dt;
    }
    this.particles = this.particles.filter((q) => q.life > 0);
  }

  private drawFx(): void {
    const g = this.fxGfx;
    g.clear();
    for (const q of this.particles) g.fillStyle(q.color, 1).fillRect(Math.round(q.x), Math.round(q.y - q.z), 2, 2);
  }
}
