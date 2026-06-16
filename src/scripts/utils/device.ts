/**
 * タッチデバイス（スマホ・タブレット）かどうかを判定する。
 * ResizeObserver コールバック内など window が必ず存在する文脈で呼ぶこと。
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

/** Canvas の DPR 上限。スマホは 1.5、デスクトップは 2 に制限する。 */
export function canvasDpr(): number {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? 1.5 : 2);
}
