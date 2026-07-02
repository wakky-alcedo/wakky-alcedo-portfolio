import type { Pauseable } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';
import { AdaptiveQuality } from '../utils/adaptiveQuality';
import { onOrientationChange } from '../utils/deviceOrientation';
import { canvasDpr } from '../utils/device';

interface CausticBlob {
  nCx: number;
  nCy: number;
  nDriftAmpX: number;
  nDriftAmpY: number;
  phaseX: number;
  phaseY: number;
  phaseR: number;
  phaseA: number;
  freqX: number;
  freqY: number;
  freqR: number;
  freqA: number;
  nBaseRadius: number;
  baseAlpha: number;
  colorIndex: 0 | 1;
  cachedGrad: CanvasGradient | null;
  cachedGradR: number;
}

const BLOB_COUNT_NORMAL = 14;
const BLOB_COUNT_LITE = 5;

const RADIUS_MIN_NORM = 0.08;
const RADIUS_MAX_NORM = 0.20;

const BASE_ALPHA_MIN = 0.18;
const BASE_ALPHA_MAX = 0.38;

const RADIUS_PULSE_DEPTH = 0.25;
const ALPHA_PULSE_DEPTH = 0.35;

// 漂流の角周波数範囲 (rad/s)
const FREQ_MIN = 0.18;
const FREQ_MAX = 0.55;

const DRIFT_AMP_NORM = 0.08;

const TILT_PARALLAX_PX = 12;
const PARALLAX_LERP = 3;

// パレット色: 0=cyan, 1=blue
const CAUSTIC_COLORS: [string, string] = ['#68CED6', '#0063AA'];

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

export class CausticsEffect implements Pauseable {
  private readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;
  private blobs: CausticBlob[] = [];
  private resizeObserver?: ResizeObserver;
  private rafId = 0;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private running = false;
  private liteMode = false;
  private quality = new AdaptiveQuality();
  private unsubscribeQuality?: () => void;
  private targetTiltX = 0;
  private tiltX = 0;
  private unsubscribeOrientation?: () => void;

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

    this.liteMode = this.quality.isLiteMode();
    this.unsubscribeQuality = this.quality.onChange((lite) => this.applyLiteMode(lite));

    document.addEventListener('orientation:enabled', this.handleOrientationEnabled);

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.canvas);
    this.handleResize();

    this.spawnBlobs(this.liteMode ? BLOB_COUNT_LITE : BLOB_COUNT_NORMAL);

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  destroy(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.unsubscribeQuality?.();
    this.unsubscribeOrientation?.();
    document.removeEventListener('orientation:enabled', this.handleOrientationEnabled);
  }

  private handleOrientationEnabled = (): void => {
    this.unsubscribeOrientation?.();
    this.unsubscribeOrientation = onOrientationChange((tilt) => {
      this.targetTiltX = tilt;
    });
  };

  private handleResize(): void {
    this.dpr = canvasDpr();
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    // Canvas最大高キャップ (ブラウザ制限: 32767px)
    this.canvas.width = Math.min(this.width * this.dpr, 32767);
    this.canvas.height = Math.min(this.height * this.dpr, 32767);
    // リサイズ後はグラデーションキャッシュを無効化
    for (const blob of this.blobs) {
      blob.cachedGrad = null;
    }
  }

  private spawnBlobs(count: number): void {
    this.blobs = Array.from({ length: count }, (): CausticBlob => ({
      nCx: Math.random(),
      nCy: Math.random(),
      nDriftAmpX: DRIFT_AMP_NORM * (0.5 + Math.random() * 0.5),
      nDriftAmpY: DRIFT_AMP_NORM * (0.5 + Math.random() * 0.5),
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      phaseR: Math.random() * Math.PI * 2,
      phaseA: Math.random() * Math.PI * 2,
      freqX: FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN),
      freqY: FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN),
      freqR: FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN),
      freqA: FREQ_MIN + Math.random() * (FREQ_MAX - FREQ_MIN),
      nBaseRadius: RADIUS_MIN_NORM + Math.random() * (RADIUS_MAX_NORM - RADIUS_MIN_NORM),
      baseAlpha: BASE_ALPHA_MIN + Math.random() * (BASE_ALPHA_MAX - BASE_ALPHA_MIN),
      colorIndex: Math.random() < 0.7 ? 0 : 1,
      cachedGrad: null,
      cachedGradR: 0,
    }));
  }

  private applyLiteMode(lite: boolean): void {
    if (!lite) return;
    this.liteMode = true;
    this.spawnBlobs(BLOB_COUNT_LITE);
  }

  private loop = (time: number): void => {
    if (!this.running) return;
    const dt = Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.quality.recordFrame(time - this.lastTime + dt * 1000);
    this.update(dt);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    this.tiltX += (this.targetTiltX - this.tiltX) * Math.min(1, dt * PARALLAX_LERP);
    for (const blob of this.blobs) {
      blob.phaseX += blob.freqX * dt;
      blob.phaseY += blob.freqY * dt;
      blob.phaseR += blob.freqR * dt;
      blob.phaseA += blob.freqA * dt;
    }
  }

  private draw(): void {
    const { ctx } = this;
    if (!ctx) return;

    const w = this.canvas.width;
    const h = this.canvas.height;
    const minDim = Math.min(this.width, this.height);

    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';

    for (const blob of this.blobs) {
      const x =
        blob.nCx * this.width +
        Math.sin(blob.phaseX) * blob.nDriftAmpX * minDim +
        this.tiltX * TILT_PARALLAX_PX;

      const y =
        blob.nCy * this.height +
        Math.cos(blob.phaseY) * blob.nDriftAmpY * minDim;

      const r =
        blob.nBaseRadius * minDim * (1 + RADIUS_PULSE_DEPTH * Math.sin(blob.phaseR));

      const a =
        blob.baseAlpha * (1 - ALPHA_PULSE_DEPTH + ALPHA_PULSE_DEPTH * Math.sin(blob.phaseA));

      const px = x * this.dpr;
      const py = y * this.dpr;
      const pr = r * this.dpr;

      // グラデーションキャッシュ: 半径が前フレームと同じなら再利用
      if (!blob.cachedGrad || Math.abs(pr - blob.cachedGradR) > 0.5) {
        const color = CAUSTIC_COLORS[blob.colorIndex];
        const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
        grad.addColorStop(0, hexToRgba(color, 1.0));
        grad.addColorStop(0.4, hexToRgba(color, 0.55));
        grad.addColorStop(1, hexToRgba(color, 0));
        blob.cachedGrad = grad;
        blob.cachedGradR = pr;
      }

      ctx.fillStyle = blob.cachedGrad;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
