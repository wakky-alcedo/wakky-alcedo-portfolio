/** CustomImage（src/components/content/CustomImage.astro）のライトボックス設定 */
export const LIGHTBOX = {
  /** 拡大表示用画像の最大幅（px）。表示上限 1200px × DPR2 を想定。元画像より大きくはしない */
  maxWidth: 2400,
} as const;
