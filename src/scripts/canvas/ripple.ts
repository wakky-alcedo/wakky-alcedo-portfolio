import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';
import { canvasDpr, isMobile } from '../utils/device';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  lineWidth: number;
}

const SPAWN_INTERVAL_MIN = 1800;
const SPAWN_INTERVAL_MAX = 3600;
const RIPPLE_GROWTH = 38; // px per second
const BLUR_PX = 3;

interface DiveEventDetail {
  x?: number; // 0..1, ratio across canvas width
}

/**
 * 水面リプル: ctx.filter + OffscreenCanvas で波紋を描画する。
 * prefers-reduced-motion 時は静的なグラデーションのみ表示する。
 */
export class WaterRipple implements Pauseable {
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private offscreen: OffscreenCanvas | null = null;
  private offCtx: OffscreenCanvasRenderingContext2D | null = null;
  private ripples: Ripple[] = [];
  private rafId = 0;
  private spawnTimeoutId = 0;
  private lastTime = 0;
  private resizeObserver?: ResizeObserver;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): void {
    if (this.running) return;
    this.running = true;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
    this.handleResize();

    window.addEventListener('kingfisher:dive', this.handleDive as EventListener);

    if (prefersReducedMotion()) {
      this.drawStatic();
      return;
    }

    this.scheduleSpawn();
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    clearTimeout(this.spawnTimeoutId);
    this.resizeObserver?.disconnect();
    window.removeEventListener('kingfisher:dive', this.handleDive as EventListener);
  }

  private handleResize(): void {
    this.dpr = canvasDpr();
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height);
    this.offCtx = this.offscreen.getContext('2d');

    if (prefersReducedMotion()) this.drawStatic();
  }

  private scheduleSpawn(): void {
    const delay = SPAWN_INTERVAL_MIN + Math.random() * (SPAWN_INTERVAL_MAX - SPAWN_INTERVAL_MIN);
    this.spawnTimeoutId = window.setTimeout(() => {
      this.spawnRipple(Math.random());
      if (this.running) this.scheduleSpawn();
    }, delay);
  }

  private spawnRipple(xRatio: number, big = false): void {
    if (this.width === 0) return;
    this.ripples.push({
      x: xRatio * this.width,
      y: this.height * 0.5,
      radius: 0,
      maxRadius: big ? this.height * 1.6 : this.height * 0.9,
      alpha: big ? 0.55 : 0.35,
      lineWidth: big ? 3 : 1.5,
    });
  }

  private handleDive = (event: Event): void => {
    const detail = (event as CustomEvent<DiveEventDetail>).detail ?? {};
    this.spawnRipple(detail.x ?? 0.7, true);
  };

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.update(dt);
    this.draw();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    for (const ripple of this.ripples) {
      ripple.radius += RIPPLE_GROWTH * dt;
      ripple.alpha = Math.max(0, ripple.alpha - dt * 0.18);
    }
    this.ripples = this.ripples.filter((r) => r.alpha > 0.01 && r.radius < r.maxRadius);
  }

  private draw(): void {
    const { ctx } = this;
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // スマホではOffscreenCanvas+blurをスキップし直接描画する
    if (isMobile()) {
      ctx.clearRect(0, 0, w, h);
      for (const ripple of this.ripples) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(104, 206, 214, ${ripple.alpha})`;
        ctx.lineWidth = ripple.lineWidth * this.dpr;
        ctx.ellipse(
          ripple.x * this.dpr,
          ripple.y * this.dpr,
          ripple.radius * this.dpr,
          ripple.radius * 0.35 * this.dpr,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      return;
    }

    const { offscreen, offCtx } = this;
    if (!offscreen || !offCtx) return;

    offCtx.clearRect(0, 0, w, h);
    offCtx.filter = `blur(${BLUR_PX * this.dpr}px)`;

    for (const ripple of this.ripples) {
      offCtx.beginPath();
      offCtx.strokeStyle = `rgba(104, 206, 214, ${ripple.alpha})`;
      offCtx.lineWidth = ripple.lineWidth * this.dpr;
      offCtx.ellipse(
        ripple.x * this.dpr,
        ripple.y * this.dpr,
        ripple.radius * this.dpr,
        ripple.radius * 0.35 * this.dpr,
        0,
        0,
        Math.PI * 2,
      );
      offCtx.stroke();
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(offscreen, 0, 0);
  }

  private drawStatic(): void {
    const { ctx } = this;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(104, 206, 214, 0.25)');
    gradient.addColorStop(1, 'rgba(104, 206, 214, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}
