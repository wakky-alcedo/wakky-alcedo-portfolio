import { CANVAS } from '../../config/scene';

/**
 * タッチデバイス（スマホ・タブレット）かどうかを判定する。
 * ResizeObserver コールバック内など window が必ず存在する文脈で呼ぶこと。
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(max-width: 768px)').matches;
}

/** Canvas の DPR。上限は src/config/scene.ts の CANVAS で設定する。 */
export function canvasDpr(): number {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? CANVAS.maxDprMobile : CANVAS.maxDprDesktop);
}
