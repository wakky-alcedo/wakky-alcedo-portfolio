/** dev 専用の記事エディタ（src/dev-editor/）の設定 */
export const EDITOR = {
  /** 入力が止まってから自動保存するまでの時間（ms） */
  autosaveDelayMs: 1000,
  /** 記事として扱うコレクション（src/content/<名前>/） */
  collections: ['works', 'blog'],
  /** ドロップした画像の保存先（src/assets/images/<記事名>/<記事名>-<連番>.<拡張子>） */
  imageDir: 'src/assets/images',
  /** 受け付ける画像の拡張子（Astro の画像最適化が扱える形式） */
  imageExtensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'],
  /** アップロードの上限（バイト） */
  maxUploadBytes: 30 * 1024 * 1024,
  /** 新規作成時の works のサムネイル（works は thumbnail 必須のため仮の画像を入れておく） */
  placeholderThumbnail: 'src/assets/images/placeholder-thumbnail.png',
  /** フロントマターのタグ欄に候補として出す、よく使うタグの数 */
  tagSuggestions: 24,
  /**
   * 保存時に、どこからも使われていない記事の画像（imageDir/<記事名>/ の中）を移す先。
   * 元に戻す（Ctrl+Z）で記事に戻ったときは、次の保存でここから戻す。git には含めない
   */
  trashDir: '.dev-editor-trash',
  /** アップロードしてからこの時間（ms）は、使われていなくても移さない（貼り付けと保存が行き違うため） */
  orphanGraceMs: 60 * 1000,
} as const;
