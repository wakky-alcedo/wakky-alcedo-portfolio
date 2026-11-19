import { TILT } from '../../config/scene';

/**
 * 端末の左右傾き(gamma)を-1〜1に正規化してコールバックに渡す。
 * Footerのトグルで`orientation:enabled`が発火した後に呼び出すこと。
 */
export function onOrientationChange(callback: (tiltX: number) => void): () => void {
  const handler = (event: DeviceOrientationEvent) => {
    const gamma = event.gamma ?? 0;
    const normalized = Math.max(-1, Math.min(1, gamma / TILT.maxGammaDeg));
    callback(normalized);
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
}

/**
 * 傾きパララックス用の値（-1〜1）を保持する。
 * `orientation:enabled` を受けてから購読を始め、update(dt) で目標値へなめらかに追従する。
 */
export class TiltTracker {
  private target = 0;
  private current = 0;
  private unsubscribe?: () => void;

  get value(): number {
    return this.current;
  }

  start(): void {
    document.addEventListener('orientation:enabled', this.handleEnabled);
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    document.removeEventListener('orientation:enabled', this.handleEnabled);
  }

  update(dt: number): void {
    this.current += (this.target - this.current) * Math.min(1, dt * TILT.lerpPerSec);
  }

  private handleEnabled = (): void => {
    this.unsubscribe?.();
    this.unsubscribe = onOrientationChange((tilt) => {
      this.target = tilt;
    });
  };
}

export async function requestOrientationPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;

  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    try {
      // ⚠️ 必ずユーザーのclickハンドラ内から直接呼ぶこと
      const result = await (DeviceOrientationEvent as any).requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
  // Android: パーミッション不要
  return true;
}
