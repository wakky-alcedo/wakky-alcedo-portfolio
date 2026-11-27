import { CanvasAnimation } from './canvasAnimation';
import { RIPPLE } from '../../config/scene';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  lineWidth: number;
}

interface DiveEventDetail {
  x?: number; // 0..1, ratio across canvas width
}

/**
 * 水面リプル: ctx.filter + OffscreenCanvas で波紋を描画する。
 * スマホでは blur を省いて直接描画し、prefers-reduced-motion 時は静的なグラデーションのみ表示する。
 */
export class WaterRipple extends CanvasAnimation {
  private offscreen: OffscreenCanvas | null = null;
  private offCtx: OffscreenCanvasRenderingContext2D | null = null;
  private ripples: Ripple[] = [];
  private spawnTimeoutId = 0;

  protected setup(): void {
    window.addEventListener('kingfisher:dive', this.handleDive as EventListener);
    this.scheduleSpawn();
  }

  protected teardown(): void {
    window.clearTimeout(this.spawnTimeoutId);
    window.removeEventListener('kingfisher:dive', this.handleDive as EventListener);
  }

  protected onPause(): void {
    window.clearTimeout(this.spawnTimeoutId);
  }

  protected onResume(): void {
    this.scheduleSpawn();
  }

  protected onResize(): void {
    if (this.mobile) {
      this.offscreen = null;
      this.offCtx = null;
      return;
    }
    this.offscreen = new OffscreenCanvas(this.canvas.width, this.canvas.height);
    this.offCtx = this.offscreen.getContext('2d');
  }

  private scheduleSpawn(): void {
    window.clearTimeout(this.spawnTimeoutId);
    const delay =
      RIPPLE.spawnIntervalMinMs + Math.random() * (RIPPLE.spawnIntervalMaxMs - RIPPLE.spawnIntervalMinMs);
    this.spawnTimeoutId = window.setTimeout(() => {
      this.spawnRipple(Math.random());
      this.scheduleSpawn();
    }, delay);
  }

  private spawnRipple(xRatio: number, big = false): void {
    if (this.width === 0) return;
    const style = big ? RIPPLE.big : RIPPLE.normal;
    this.ripples.push({
      x: xRatio * this.width,
      y: this.height * RIPPLE.centerYRatio,
      radius: 0,
      maxRadius: this.height * style.maxRadius,
      alpha: style.alpha,
      lineWidth: style.lineWidth,
    });
  }

  private handleDive = (event: Event): void => {
    const detail = (event as CustomEvent<DiveEventDetail>).detail ?? {};
    this.spawnRipple(detail.x ?? RIPPLE.defaultDiveX, true);
  };

  protected update(dt: number): void {
    for (const ripple of this.ripples) {
      ripple.radius += RIPPLE.growthPxPerSec * dt;
      ripple.alpha = Math.max(0, ripple.alpha - dt * RIPPLE.fadePerSec);
    }
    this.ripples = this.ripples.filter((r) => r.alpha > 0.01 && r.radius < r.maxRadius);
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const { offscreen, offCtx } = this;

    // スマホは blur なしで直接、それ以外は OffscreenCanvas に blur をかけて描いてから合成する
    const target = offscreen && offCtx ? offCtx : ctx;
    target.clearRect(0, 0, w, h);
    if (target === offCtx) offCtx.filter = `blur(${RIPPLE.blurPx * this.dpr}px)`;

    for (const ripple of this.ripples) {
      target.beginPath();
      target.strokeStyle = `rgba(${RIPPLE.colorRgb}, ${ripple.alpha})`;
      target.lineWidth = ripple.lineWidth * this.dpr;
      target.ellipse(
        ripple.x * this.dpr,
        ripple.y * this.dpr,
        ripple.radius * this.dpr,
        ripple.radius * RIPPLE.ellipseRatio * this.dpr,
        0,
        0,
        Math.PI * 2,
      );
      target.stroke();
    }

    if (offscreen && target === offCtx) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(offscreen, 0, 0);
    }
  }

  protected drawStatic(): void {
    const { ctx } = this;
    if (!ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `rgba(${RIPPLE.colorRgb}, ${RIPPLE.staticAlpha})`);
    gradient.addColorStop(1, `rgba(${RIPPLE.colorRgb}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}
