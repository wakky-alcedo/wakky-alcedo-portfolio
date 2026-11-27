import { CanvasAnimation } from './canvasAnimation';
import { AdaptiveQuality } from '../utils/adaptiveQuality';
import { TiltTracker } from '../utils/deviceOrientation';
import { CAUSTICS } from '../../config/scene';

interface CausticBlob {
  /** 中心位置（画面幅・画面高に対する比） */
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
  /** 原点中心のグラデーション（描画時に translate するので位置が変わっても再利用できる） */
  cachedGrad: CanvasGradient | null;
  cachedGradR: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * 水中コースティクス（水面から差し込む揺らめく光）。
 * canvas はビューポートサイズで、ページスクロールに合わせて光をずらし、水中を進んでいるように見せる。
 */
export class CausticsEffect extends CanvasAnimation {
  private blobs: CausticBlob[] = [];
  private tilt = new TiltTracker();
  private lastScrollY = 0;
  private unsubscribeQuality?: () => void;

  constructor(canvas: HTMLCanvasElement) {
    super(canvas);
    this.quality = new AdaptiveQuality();
  }

  protected setup(): void {
    this.unsubscribeQuality = this.quality?.onChange(() => this.syncBlobCount());
    this.tilt.start();
    this.lastScrollY = window.scrollY;
    this.syncBlobCount();
  }

  protected teardown(): void {
    this.unsubscribeQuality?.();
    this.tilt.stop();
  }

  protected onResize(): void {
    for (const blob of this.blobs) blob.cachedGrad = null;
    if (this.blobs.length > 0) this.syncBlobCount();
  }

  /** 画面面積と品質モードから決まる数に光の数を合わせる */
  private syncBlobCount(): void {
    const density = this.quality?.isLiteMode() ? CAUSTICS.liteDensityPerMpx : CAUSTICS.densityPerMpx;
    const target = Math.max(CAUSTICS.minCount, Math.round((density * this.width * this.height) / 1e6));
    while (this.blobs.length < target) this.blobs.push(this.createBlob());
    this.blobs.length = target;
  }

  private createBlob(): CausticBlob {
    const freq = () => randomBetween(CAUSTICS.freqMin, CAUSTICS.freqMax);
    const phase = () => Math.random() * Math.PI * 2;
    return {
      nCx: Math.random(),
      nCy: Math.random(),
      nDriftAmpX: CAUSTICS.driftAmp * randomBetween(0.5, 1),
      nDriftAmpY: CAUSTICS.driftAmp * randomBetween(0.5, 1),
      phaseX: phase(),
      phaseY: phase(),
      phaseR: phase(),
      phaseA: phase(),
      freqX: freq(),
      freqY: freq(),
      freqR: freq(),
      freqA: freq(),
      nBaseRadius: randomBetween(CAUSTICS.radiusMin, CAUSTICS.radiusMax),
      baseAlpha: randomBetween(CAUSTICS.baseAlphaMin, CAUSTICS.baseAlphaMax),
      colorIndex: Math.random() < CAUSTICS.primaryColorChance ? 0 : 1,
      cachedGrad: null,
      cachedGradR: 0,
    };
  }

  protected update(dt: number): void {
    this.tilt.update(dt);

    const scrollY = window.scrollY;
    const scrollShift = this.height > 0 ? ((scrollY - this.lastScrollY) * CAUSTICS.scrollFactor) / this.height : 0;
    this.lastScrollY = scrollY;

    const { wrapMargin } = CAUSTICS;
    for (const blob of this.blobs) {
      blob.phaseX += blob.freqX * dt;
      blob.phaseY += blob.freqY * dt;
      blob.phaseR += blob.freqR * dt;
      blob.phaseA += blob.freqA * dt;

      blob.nCy -= scrollShift;
      if (blob.nCy < -wrapMargin) blob.nCy += 1 + wrapMargin * 2;
      if (blob.nCy > 1 + wrapMargin) blob.nCy -= 1 + wrapMargin * 2;
    }
  }

  protected draw(ctx: CanvasRenderingContext2D): void {
    // 光の大きさ・漂流幅は画面幅基準（縦長のスマホでも横長のPCでも見た目の比率をそろえる）
    const scale = this.width;
    const [midPos, midAlpha] = CAUSTICS.gradientMidStop;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = 'screen';

    for (const blob of this.blobs) {
      const x =
        blob.nCx * this.width + Math.sin(blob.phaseX) * blob.nDriftAmpX * scale + this.tilt.value * CAUSTICS.tiltParallaxPx;
      const y = blob.nCy * this.height + Math.cos(blob.phaseY) * blob.nDriftAmpY * scale;
      const r = blob.nBaseRadius * scale * (1 + CAUSTICS.radiusPulseDepth * Math.sin(blob.phaseR));
      const a = blob.baseAlpha * (1 - CAUSTICS.alphaPulseDepth + CAUSTICS.alphaPulseDepth * Math.sin(blob.phaseA));
      const pr = r * this.dpr;

      if (!blob.cachedGrad || Math.abs(pr - blob.cachedGradR) > 0.5) {
        const color = CAUSTICS.colors[blob.colorIndex];
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, pr);
        grad.addColorStop(0, hexToRgba(color, 1));
        grad.addColorStop(midPos, hexToRgba(color, midAlpha));
        grad.addColorStop(1, hexToRgba(color, 0));
        blob.cachedGrad = grad;
        blob.cachedGradR = pr;
      }

      ctx.setTransform(1, 0, 0, 1, x * this.dpr, y * this.dpr);
      ctx.fillStyle = blob.cachedGrad;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.ellipse(0, 0, pr, pr * CAUSTICS.ellipseRatio, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}
