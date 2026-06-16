import { isMobile } from './device';

const FRAME_BUDGET_MS = 16;
const BAD_STREAK_LIMIT = 30; // 約0.5秒分の連続コマ落ちでliteMode発動

/**
 * フレームレートを監視し、コマ落ちが連続したら liteMode に切り替える。
 * スマホは起動直後から liteMode。一度 liteMode になったら自動復帰はしない。
 */
export class AdaptiveQuality {
  private badStreak = 0;
  private lite = isMobile();
  private listeners = new Set<(lite: boolean) => void>();

  recordFrame(durationMs: number): void {
    if (this.lite) return;

    if (durationMs > FRAME_BUDGET_MS) {
      this.badStreak += 1;
      if (this.badStreak >= BAD_STREAK_LIMIT) {
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
