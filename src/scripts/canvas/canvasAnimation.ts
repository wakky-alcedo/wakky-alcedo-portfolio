import type { Pauseable, SceneModule } from '../utils/visibility';
import { prefersReducedMotion } from '../utils/motionPreference';
import { canvasDpr, isMobile } from '../utils/device';
import type { AdaptiveQuality } from '../utils/adaptiveQuality';
import { CANVAS } from '../../config/scene';

/**
 * Canvas アニメーションの基底クラス。
 * 描画ループ（dt 計算・一時停止）、ResizeObserver による DPR 対応のリサイズ、
 * reduced-motion 時の静止描画を受け持つ。サブクラスは update / draw だけを実装する。
 */
export abstract class CanvasAnimation implements SceneModule, Pauseable {
  protected readonly canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D | null = null;
  /** canvas の表示サイズ（CSS px） */
  protected width = 0;
  protected height = 0;
  protected dpr = 1;
  /** スマホ幅か（リサイズ時に更新。毎フレーム matchMedia しないため） */
  protected mobile = false;
  /** 設定するとフレーム間隔を記録する */
  protected quality?: AdaptiveQuality;

  private resizeObserver?: ResizeObserver;
  private rafId = 0;
  private lastTime = 0;
  /** init 済み（destroy で false） */
  private active = false;
  /** setup が完了しループを回せる状態 */
  private ready = false;
  private paused = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  init(): void {
    if (this.active) return;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.active = true;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();

    if (prefersReducedMotion()) {
      this.drawStatic();
      return;
    }

    Promise.resolve(this.setup())
      .then(() => {
        if (!this.active) return;
        this.ready = true;
        if (!this.paused) this.startLoop();
      })
      .catch(() => {
        // 準備に失敗した場合（画像読み込み失敗など）は何も描画しない
      });
  }

  destroy(): void {
    this.active = false;
    this.ready = false;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver?.disconnect();
    this.teardown();
  }

  pause(): void {
    this.paused = true;
    cancelAnimationFrame(this.rafId);
    this.onPause();
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    if (!this.active || !this.ready) return;
    this.onResume();
    this.startLoop();
  }

  /** ループ開始前の準備（画像読み込み・イベント購読など）。Promise を返すと完了を待つ */
  protected setup(): void | Promise<void> {}

  /** destroy 時の後始末（setup で付けたリスナーの解除など） */
  protected teardown(): void {}

  /** pause / resume 時の追加処理（タイマーの停止・再開など） */
  protected onPause(): void {}
  protected onResume(): void {}

  /** リサイズ後の追加処理。width / height / dpr は更新済み */
  protected onResize(): void {}

  /** reduced-motion 時の静止描画 */
  protected drawStatic(): void {}

  protected abstract update(dt: number): void;
  protected abstract draw(ctx: CanvasRenderingContext2D): void;

  private resize(): void {
    this.dpr = canvasDpr();
    this.mobile = isMobile();
    this.width = this.canvas.clientWidth;
    this.height = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.onResize();
    if (prefersReducedMotion()) this.drawStatic();
  }

  private startLoop(): void {
    cancelAnimationFrame(this.rafId);
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.loop);
  }

  private loop = (time: number): void => {
    if (!this.active || this.paused || !this.ctx) return;
    // rAF のタイムスタンプは startLoop 時の performance.now() より前になることがあるため 0 で下限を取る
    const intervalMs = Math.max(0, time - this.lastTime);
    this.lastTime = time;
    this.quality?.recordFrame(intervalMs);

    this.update(Math.min(intervalMs / 1000, CANVAS.maxDt));
    this.draw(this.ctx);
    this.rafId = requestAnimationFrame(this.loop);
  };
}
