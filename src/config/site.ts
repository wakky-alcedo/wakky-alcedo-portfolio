// トップのヒーローを 1200×630 で撮ったもの（ヘッダー・SCROLL 表示は消している）。見た目を変えたら撮り直す
import defaultOgImage from '../assets/images/og-default.webp';

/** サイト全体のメタ情報（<head> の meta・OGP・構造化データで使う。公開 URL は astro.config.mjs の site） */
export const SITE = {
  name: "Wakky-Alcedo's Portfolio",
  author: 'Wakky-Alcedo',
  description: 'Wakky-Alcedo のポートフォリオサイト。ロボット・IoT・トライアスロンなど、作品と活動を紹介。',
  locale: 'ja_JP',
  /** 記事にサムネイルがないページの OGP 画像 */
  ogImage: defaultOgImage,
  /** OGP 画像の出力サイズ（X / Facebook の推奨 1.91:1。元画像より小さいときは拡大されず元のサイズのまま） */
  ogImageSize: { width: 1200, height: 630 },
} as const;

/**
 * 連絡先・SNSリンク（About / Contact / トップの Contact / Footer で共通）。
 * 並び順は About の Link 一覧の表示順。
 */
export const SOCIAL = {
  twitter:   { label: 'Twitter / X', value: '@wakky_alcedo', href: 'https://twitter.com/wakky_alcedo' },
  instagram: { label: 'Instagram', value: '@taku.t_0716', href: 'https://www.instagram.com/taku.t_0716/' },
  github:    { label: 'GitHub', value: 'github.com/wakky-alcedo', href: 'https://github.com/wakky-alcedo' },
  note:      { label: 'note', value: 'note.com/wakkyalcedo', href: 'https://note.com/wakkyalcedo' },
  qiita:     { label: 'Qiita', value: 'qiita.com/wakky-alcedo', href: 'https://qiita.com/wakky-alcedo' },
  lab:       { label: '大学の所属研究室', value: 'Science Tokyo SDDL', href: 'http://www.sddl.mech.e.titech.ac.jp' },
  arte:      { label: '中心メンバーのものづくり団体', value: '*ArTe', href: 'https://arte.alcedoworks.com' },
} as const;

/** スクレイピング対策で Base64 化したメールアドレス（クリック時に atob で復元） */
export const EMAIL_ENCODED = 'd2Fra3kuYWxjZWRvQGdtYWlsLmNvbQ==';
