/** ArtCard（src/components/content/ArtCard.astro）のプレビュー設定 */
export const ART_PREVIEW = {
  /** 画面のこの距離手前でプレビューを読み込み、離れたら止める（IntersectionObserver の rootMargin） */
  rootMargin: '200px 0px',
} as const;
