/**
 * 画面幅の切り替え点（px）。
 * CSS の @media では変数を使えないため、CSS 側は同じ値を直書きする（スマホ: max-width: 640px）。
 * タブレット（〜1024px）専用の切り替えは現状なし。
 */
export const BREAKPOINTS = {
  sp: 640,
} as const;
