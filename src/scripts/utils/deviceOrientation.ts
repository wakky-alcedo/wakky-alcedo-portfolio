const TILT_MAX_GAMMA = 30; // この角度(度)でパララックスが最大になる

/**
 * 端末の左右傾き(gamma)を-1〜1に正規化してコールバックに渡す。
 * Footerのトグルで`orientation:enabled`が発火した後に呼び出すこと。
 */
export function onOrientationChange(callback: (tiltX: number) => void): () => void {
  const handler = (event: DeviceOrientationEvent) => {
    const gamma = event.gamma ?? 0;
    const normalized = Math.max(-1, Math.min(1, gamma / TILT_MAX_GAMMA));
    callback(normalized);
  };
  window.addEventListener('deviceorientation', handler);
  return () => window.removeEventListener('deviceorientation', handler);
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
