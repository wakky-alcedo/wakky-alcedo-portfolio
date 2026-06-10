import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';
import { AdaptiveQuality } from '../utils/adaptiveQuality';

interface LayerConfig {
  scale: number;
  blurPx: number;
  speed: number; // px/sec
  count: number;
}

interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  img: HTMLImageElement;
}

const FISH_BASE_SIZE = 48; // px（scale 1.0時の表示サイズ）

const LAYER_CONFIGS: LayerConfig[] = [
  { scale: 0.4, blurPx: 3, speed: 22, count: 8 }, // Layer1（奥）
  { scale: 0.6, blurPx: 1.5, speed: 32, count: 6 }, // Layer2
  { scale: 0.8, blurPx: 0.5, speed: 44, count: 4 }, // Layer3
  { scale: 1.0, blurPx: 0, speed: 58, count: 3 }, // Layer4（手前）
];

// liteMode時に使用するレイヤー（4→2に削減）
const LITE_LAYER_INDICES = [0, 3];

const SEPARATION_RADIUS = 28;
const ALIGNMENT_RADIUS = 60;
const COHESION_RADIUS = 90;
const SEPARATION_WEIGHT = 1.4;
const ALIGNMENT_WEIGHT = 0.6;
const COHESION_WEIGHT = 0.4;
const MIN_SPEED_RATIO = 0.4;

/**
 * 魚のBoidシミュレーション（4レイヤー、奥行き表現）。
 * Layer1〜3はOffscreenCanvasにctx.filterでblurをかけてから合成する。
 */
export class FishSimulation implements Pauseable {
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private images: HTMLImageElement[] = [];
  private imagesLoaded = false;
  private layers: Fish[][] = [];
  private offscreens: (OffscreenCanvas | null)[] = [];
  private offCtxs: (OffscreenCanvasRenderingContext2D | null)[] = [];
  private resizeObserver?: ResizeObserver;
  private rafId = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private quality = new AdaptiveQuality();
  private unsubscribeQuality?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): void {
    if (this.running) return;
    this.running = true;

    if (prefersReducedMotion()) return;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;

    this.unsubscribeQuality = this.quality.onChange((lite) => this.applyLiteMode(lite));

    this.loadImages()
      .then(() => {
        if (!this.running) return;

        this.resizeObserver = new ResizeObserver(() => this.handleResize());
        this.resizeObserver.observe(this.canvas);
        this.handleResize();

        if (this.layers.length === 0) {
          this.spawnFish(this.quality.isLiteMode() ? LITE_LAYER_INDICES : [0, 1, 2, 3]);
        }

        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
      })
      .catch(() => {
        // 画像読み込み失敗時は何も描画しない
      });
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.unsubscribeQuality?.();
  }

  private async loadImages(): Promise<void> {
    if (this.imagesLoaded) return;

    const srcs = [this.canvas.dataset.fish1, this.canvas.dataset.fish2].filter(
      (src): src is string => Boolean(src),
    );
    if (srcs.length === 0) throw new Error('fish image sources are missing');

    this.images = await Promise.all(
      srcs.map(
        (src) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = src;
          }),
      ),
    );
    this.imagesLoaded = true;
  }

  private handleResize(): void {
    this.dpr = window.devicePixelRatio || 1;
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;

    this.offscreens = LAYER_CONFIGS.map((layer) =>
      layer.blurPx > 0 ? new OffscreenCanvas(this.canvas.width, this.canvas.height) : null,
    );
    this.offCtxs = this.offscreens.map((off) => off?.getContext('2d') ?? null);
  }

  private spawnFish(layerIndices: number[]): void {
    this.layers = LAYER_CONFIGS.map((config, index) => {
      if (!layerIndices.includes(index)) return [];

      const count = this.quality.isLiteMode() ? Math.max(1, Math.floor(config.count / 2)) : config.count;

      return Array.from({ length: count }, () => this.createFish(config));
    });
  }

  private createFish(config: LayerConfig): Fish {
    const angle = Math.random() * Math.PI * 2;
    const speed = config.speed * (0.5 + Math.random() * 0.5);
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      img: this.images[Math.floor(Math.random() * this.images.length)],
    };
  }

  private applyLiteMode(lite: boolean): void {
    if (!lite) return;
    this.spawnFish(LITE_LAYER_INDICES);
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;

    this.quality.recordFrame(dt * 1000);

    this.update(dt);
    this.draw();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.layers.forEach((fishList, layerIndex) => {
      const config = LAYER_CONFIGS[layerIndex];
      this.flock(fishList, config, dt);
    });
  }

  private flock(fishList: Fish[], config: LayerConfig, dt: number): void {
    const maxSpeed = config.speed;
    const minSpeed = maxSpeed * MIN_SPEED_RATIO;
    const margin = FISH_BASE_SIZE * config.scale;

    for (const fish of fishList) {
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let sepCount = 0;
      let aliCount = 0;
      let cohCount = 0;

      for (const other of fishList) {
        if (other === fish) continue;
        const dx = fish.x - other.x;
        const dy = fish.y - other.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0 && dist < SEPARATION_RADIUS) {
          sepX += dx / dist;
          sepY += dy / dist;
          sepCount += 1;
        }
        if (dist < ALIGNMENT_RADIUS) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount += 1;
        }
        if (dist < COHESION_RADIUS) {
          cohX += other.x;
          cohY += other.y;
          cohCount += 1;
        }
      }

      let ax = 0;
      let ay = 0;

      if (sepCount > 0) {
        ax += (sepX / sepCount) * SEPARATION_WEIGHT;
        ay += (sepY / sepCount) * SEPARATION_WEIGHT;
      }
      if (aliCount > 0) {
        ax += (aliX / aliCount - fish.vx) * ALIGNMENT_WEIGHT * 0.05;
        ay += (aliY / aliCount - fish.vy) * ALIGNMENT_WEIGHT * 0.05;
      }
      if (cohCount > 0) {
        ax += (cohX / cohCount - fish.x) * COHESION_WEIGHT * 0.01;
        ay += (cohY / cohCount - fish.y) * COHESION_WEIGHT * 0.01;
      }

      fish.vx += ax;
      fish.vy += ay;

      const speed = Math.hypot(fish.vx, fish.vy) || 1;
      if (speed > maxSpeed) {
        fish.vx = (fish.vx / speed) * maxSpeed;
        fish.vy = (fish.vy / speed) * maxSpeed;
      } else if (speed < minSpeed) {
        fish.vx = (fish.vx / speed) * minSpeed;
        fish.vy = (fish.vy / speed) * minSpeed;
      }

      fish.x += fish.vx * dt;
      fish.y += fish.vy * dt;

      // 画面端でラップアラウンド
      if (fish.x < -margin) fish.x = this.width + margin;
      if (fish.x > this.width + margin) fish.x = -margin;
      if (fish.y < -margin) fish.y = this.height + margin;
      if (fish.y > this.height + margin) fish.y = -margin;
    }
  }

  private draw(): void {
    const { ctx } = this;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.layers.forEach((fishList, layerIndex) => {
      const config = LAYER_CONFIGS[layerIndex];
      if (config.blurPx > 0) {
        this.drawBlurredLayer(fishList, config, layerIndex);
      } else {
        this.drawFishList(ctx, fishList, config);
      }
    });
  }

  private drawBlurredLayer(fishList: Fish[], config: LayerConfig, layerIndex: number): void {
    const { ctx } = this;
    const offCtx = this.offCtxs[layerIndex];
    const offscreen = this.offscreens[layerIndex];
    if (!ctx || !offCtx || !offscreen) return;

    offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
    offCtx.filter = `blur(${config.blurPx * this.dpr}px)`;
    this.drawFishList(offCtx, fishList, config);

    ctx.drawImage(offscreen, 0, 0);
  }

  private drawFishList(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fishList: Fish[],
    config: LayerConfig,
  ): void {
    const size = FISH_BASE_SIZE * config.scale * this.dpr;

    for (const fish of fishList) {
      const dir = fish.vx >= 0 ? 1 : -1;
      const tilt = Math.atan2(fish.vy, Math.abs(fish.vx)) * 0.5;

      ctx.save();
      ctx.translate(fish.x * this.dpr, fish.y * this.dpr);
      ctx.rotate(tilt);
      ctx.scale(dir, 1);
      ctx.drawImage(fish.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}
