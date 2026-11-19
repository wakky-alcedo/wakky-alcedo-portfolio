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
} as const;

/** スクレイピング対策で Base64 化したメールアドレス（クリック時に atob で復元） */
export const EMAIL_ENCODED = 'd2Fra3kuYWxjZWRvQGdtYWlsLmNvbQ==';
