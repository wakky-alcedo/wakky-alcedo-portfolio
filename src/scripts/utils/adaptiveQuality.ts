import { isMobile } from './device';
import { ADAPTIVE_QUALITY } from '../../config/quality';

/**
 * フレーム間隔を監視し、コマ落ちが連続したら liteMode に切り替える。
 * スマホは起動直後から liteMode。一度 liteMode になったら自動復帰はしない。
 */
export class AdaptiveQuality {
  private badStreak = 0;
  private lite = isMobile();
  private listeners = new Set<(lite: boolean) => void>();

  recordFrame(durationMs: number): void {
    if (this.lite) return;

    if (durationMs > ADAPTIVE_QUALITY.frameBudgetMs) {
      this.badStreak += 1;
      if (this.badStreak >= ADAPTIVE_QUALITY.badStreakLimit) {
        this.lite = true;
        this.listeners.forEach((cb) => cb(true));
      }
    } else {
      this.badStreak = 0;
    }
  }

  isLiteMode(): boolean {
    return this.lite;
  }

  onChange(callback: (lite: boolean) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}
