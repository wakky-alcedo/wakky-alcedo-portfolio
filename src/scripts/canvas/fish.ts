import { CanvasAnimation } from './canvasAnimation';
import { AdaptiveQuality } from '../utils/adaptiveQuality';
import { TiltTracker } from '../utils/deviceOrientation';
import { FISH } from '../../config/scene';

type LayerConfig = (typeof FISH.layers)[number];

interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  img: HTMLImageElement;
}

const ALL_LAYER_INDICES = FISH.layers.map((_, index) => index);

/**
 * 魚のBoidシミュレーション（4レイヤー、奥行き表現）。
 * canvas はビューポートサイズで、ページスクロールに合わせてレイヤーごとの速さで魚をずらす（奥ほどゆっくり）。
 * blur のあるレイヤーは OffscreenCanvas に ctx.filter をかけてから合成する（スマホは blur なし）。
 */
export class FishSimulation extends CanvasAnimation {
  private images: HTMLImageElement[] = [];
  private layers: Fish[][] = FISH.layers.map(() => []);
  private offscreens: (OffscreenCanvas | null)[] = [];
  private offCtxs: (OffscreenCanvasRenderingContext2D | null)[] = [];
  private pointer: { x: number; y: number } | null = null;
  private tilt = new TiltTracker();
  private lastScrollY = 0;
  private unsubscribeQuality?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.quality = new AdaptiveQuality();
  }

  protected async setup(): Promise<void> {
    await this.loadImages();

    this.unsubscribeQuality = this.quality?.onChange(() => this.syncFishCount());
    window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    window.addEventListener('pointerleave', this.handlePointerLeave, { passive: true });
    window.addEventListener('kingfisher:catch', this.handleCatch as EventListener);
    this.tilt.start();

    this.lastScrollY = window.scrollY;
    this.syncFishCount();
  }

  protected teardown(): void {
    this.unsubscribeQuality?.();
    this.tilt.stop();
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointerleave', this.handlePointerLeave);
    window.removeEventListener('kingfisher:catch', this.handleCatch as EventListener);
  }

  protected onResize(): void {
    this.offscreens = FISH.layers.map((layer) =>
      layer.blurPx > 0 && !this.mobile ? new OffscreenCanvas(this.canvas.width, this.canvas.height) : null,
    );
    this.offCtxs = this.offscreens.map((off) => off?.getContext('2d') ?? null);
    if (this.images.length > 0) this.syncFishCount();
  }

  private async loadImages(): Promise<void> {
    if (this.images.length > 0) return;

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
  }

  /** 画面面積と品質モードから決まる匹数に各レイヤーを合わせる（既存の魚はそのまま残す） */
  private syncFishCount(): void {
    const lite = this.quality?.isLiteMode() ?? false;
    const activeLayers: readonly number[] = lite ? FISH.liteLayerIndices : ALL_LAYER_INDICES;
    const areaMpx = (this.width * this.height) / 1e6;

    FISH.layers.forEach((config, index) => {
      const list = this.layers[index];
      let target = 0;
      if (activeLayers.includes(index)) {
        const count = config.densityPerMpx * areaMpx * (lite ? FISH.liteCountRatio : 1);
        target = Math.max(FISH.minCountPerLayer, Math.round(count));
      }
      while (list.length < target) list.push(this.createFish(config));
      list.length = target;
    });
  }

  private createFish(config: LayerConfig): Fish {
    const angle = Math.random() * Math.PI * 2;
    const speed = config.speed * (FISH.boid.minSpawnSpeedRatio + Math.random() * (1 - FISH.boid.minSpawnSpeedRatio));
    return {
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      img: this.images[Math.floor(Math.random() * this.images.length)],
    };
  }

  private getCanvasLocalPoint(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y };
  }

  private handlePointerMove = (event: PointerEvent): void => {
    this.pointer = this.getCanvasLocalPoint(event.clientX, event.clientY);
  };

  private handlePointerLeave = (): void => {
    this.pointer = null;
  };

  private handlePointerDown = (event: PointerEvent): void => {
    const point = this.getCanvasLocalPoint(event.clientX, event.clientY);
    if (!point) return;

    for (const layerIndex of FISH.fleeLayerIndices) {
      const config = FISH.layers[layerIndex];
      for (const fish of this.layers[layerIndex]) {
        const dx = fish.x - point.x;
        const dy = fish.y - point.y;
        const dist = Math.hypot(dx, dy);
        if (dist < FISH.fleeClickRadius) {
          const dirX = dist > 0 ? dx / dist : Math.random() * 2 - 1;
          const dirY = dist > 0 ? dy / dist : Math.random() * 2 - 1;
          fish.vx = dirX * config.speed;
          fish.vy = dirY * config.speed;
        }
      }
    }
  };

  /** カワセミのキャッチ: 近くの魚（いなければ手前レイヤーのどれか）を1匹差し替える */
  private handleCatch = (event: Event): void => {
    const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (!detail) return;
    const point = this.getCanvasLocalPoint(detail.x, detail.y);

    let target: { layerIndex: number; fish: Fish } | null = null;
    let bestDist: number = FISH.catchRadius;

    if (point) {
      for (const layerIndex of FISH.fleeLayerIndices) {
        for (const fish of this.layers[layerIndex]) {
          const dist = Math.hypot(fish.x - point.x, fish.y - point.y);
          if (dist < bestDist) {
            bestDist = dist;
            target = { layerIndex, fish };
          }
        }
      }
    }

    if (!target) {
      const layerIndex = FISH.fleeLayerIndices[FISH.fleeLayerIndices.length - 1];
      const list = this.layers[layerIndex];
      if (list.length) target = { layerIndex, fish: list[Math.floor(Math.random() * list.length)] };
    }

    if (target) {
      const { layerIndex, fish } = target;
      const list = this.layers[layerIndex];
      list[list.indexOf(fish)] = this.createFish(FISH.layers[layerIndex]);
    }
  };

  protected update(dt: number): void {
    this.tilt.update(dt);

    const scrollY = window.scrollY;
    const scrollDelta = scrollY - this.lastScrollY;
    this.lastScrollY = scrollY;

    this.layers.forEach((fishList, layerIndex) => {
      const config = FISH.layers[layerIndex];
      const scrollShift = scrollDelta * config.scrollFactor;
      for (const fish of fishList) fish.y -= scrollShift;
      this.flock(fishList, config, layerIndex, dt);
    });
  }

  private flock(fishList: Fish[], config: LayerConfig, layerIndex: number, dt: number): void {
    const { boid } = FISH;
    const maxSpeed = config.speed;
    const minSpeed = maxSpeed * boid.minSpeedRatio;
    const margin = FISH.baseSize * config.scale;
    const flees = (FISH.fleeLayerIndices as readonly number[]).includes(layerIndex);

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

        if (dist > 0 && dist < boid.separationRadius) {
          sepX += dx / dist;
          sepY += dy / dist;
          sepCount += 1;
        }
        if (dist < boid.alignmentRadius) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount += 1;
        }
        if (dist < boid.cohesionRadius) {
          cohX += other.x;
          cohY += other.y;
          cohCount += 1;
        }
      }

      let ax = 0;
      let ay = 0;

      if (sepCount > 0) {
        ax += (sepX / sepCount) * boid.separationWeight;
        ay += (sepY / sepCount) * boid.separationWeight;
      }
      if (aliCount > 0) {
        ax += (aliX / aliCount - fish.vx) * boid.alignmentWeight;
        ay += (aliY / aliCount - fish.vy) * boid.alignmentWeight;
      }
      if (cohCount > 0) {
        ax += (cohX / cohCount - fish.x) * boid.cohesionWeight;
        ay += (cohY / cohCount - fish.y) * boid.cohesionWeight;
      }

      if (flees && this.pointer) {
        const dx = fish.x - this.pointer.x;
        const dy = fish.y - this.pointer.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < FISH.fleeRadius) {
          const force = (1 - dist / FISH.fleeRadius) * FISH.fleeWeight;
          ax += (dx / dist) * force * maxSpeed;
          ay += (dy / dist) * force * maxSpeed;
        }
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

      // 画面端でラップアラウンド（スクロールで画面外に出た魚も反対側から戻る）
      if (fish.x < -margin) fish.x = this.width + margin;
      if (fish.x > this.width + margin) fish.x = -margin;
      if (fish.y < -margin) fish.y += this.height + margin * 2;
      if (fish.y > this.height + margin) fish.y -= this.height + margin * 2;
    }
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.layers.forEach((fishList, layerIndex) => {
      if (fishList.length === 0) return;
      const offCtx = this.offCtxs[layerIndex];
      const offscreen = this.offscreens[layerIndex];
      if (offCtx && offscreen) {
        offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
        offCtx.filter = `blur(${FISH.layers[layerIndex].blurPx * this.dpr}px)`;
        this.drawFishList(offCtx, fishList, layerIndex);
        ctx.drawImage(offscreen, 0, 0);
      } else {
        this.drawFishList(ctx, fishList, layerIndex);
      }
    });
  }

  private drawFishList(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    fishList: Fish[],
    layerIndex: number,
  ): void {
    const config = FISH.layers[layerIndex];
    const size = FISH.baseSize * config.scale * this.dpr;
    const offsetX = this.tilt.value * config.parallaxPx * this.dpr;

    for (const fish of fishList) {
      const dir = fish.vx >= 0 ? 1 : -1;
      const bodyTilt = Math.atan2(fish.vy, Math.abs(fish.vx)) * FISH.boid.bodyTiltRatio;

      ctx.save();
      ctx.translate(fish.x * this.dpr + offsetX, fish.y * this.dpr);
      ctx.rotate(bodyTilt);
      ctx.scale(dir, 1);
      ctx.drawImage(fish.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }
}
