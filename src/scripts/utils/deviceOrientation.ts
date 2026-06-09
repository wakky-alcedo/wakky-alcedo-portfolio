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
