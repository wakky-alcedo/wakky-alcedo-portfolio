update-about スキル

`docs/drafts/about.md` の下書きを `src/pages/about.astro`（Aboutページ）と
`src/components/home/UnderwaterSection.astro`（トップページのAboutプレビュー）に反映するスキルです。
文章・スキル一覧・年表を、Markdownの下書きを編集するだけで更新できるようにします。

使い方
/update-about と入力して呼び出してください。

## 下書きフォーマット（`docs/drafts/about.md`）

frontmatterの `name` は識別用メタデータ（未使用でよい）。本文は `##` / `###` 見出しでセクション分けする。

| 見出し | 内容 | 反映先 |
|---|---|---|
| `## name` | デフォルト（氏名・写真）とホバー時（Wakky Alcedo・wakky_alcedo_icon.jpg）の氏名・写真パス | Aboutページ プロフィール表示（ホバーで切替） |
| `## About Me for top page` | 短い自己紹介文（1〜2段落） | トップページ Aboutプレビュー（`.about-preview__text`） |
| `## About Me` | 自己紹介本文全体（複数段落・引用見出し・リスト・リンクを含む） | Aboutページ 本文 |
| `## Skills`（`###` でカテゴリ分け） | 各カテゴリの説明文＋箇条書き。箇条書き中の `**太字**` 語がスキルタグ | Aboutページは説明文をそのまま表示。タグはトップページのみで使用 |
| `## Timeline` | `年/月 イベント` のリスト | Aboutページ Timeline |
| `### Certification`（Timelineの子見出し） | 資格のリスト | AboutページのTimelineセクション内、サブリストとして表示 |
| `## Link` | SNS等のリンク・Email | Aboutページ Linkセクション |

## スキルタグの自動抽出ルール

- 抽出元：`## Skills` 配下の `###` カテゴリごとの箇条書き
- タグ名：箇条書き内の `**...**` で囲まれた語（複数あれば1項目につき複数タグになる）
- カテゴリ：その項目が属する `###` 見出しのテキスト（例: 組み込み制御、機械設計等、プログラム言語、その他）
- frontmatterに `skills:` を手動定義する必要はない。実行ごとに本文から再計算する。

## スキルの手順

### ステップ1：下書きを読む
`docs/drafts/about.md` を読み込み、上記表に従って各セクションをパースする。
`## Skills` からはスキルタグ（`{ name, category }` の配列）も抽出する。

### ステップ2：Aboutページ（`src/pages/about.astro`）を更新する
- プロフィール表示：`## name` のデフォルト/ホバー情報を反映する。
  - デフォルト：氏名「立脇 拓」＋ `src/assets/images/profile_picture.jpg`
  - ホバー時：氏名「Wakky Alcedo」＋ `src/assets/images/wakky_alcedo_icon.jpg` にクロスフェードで切り替える
- `## About Me` の本文をそのままMarkdownレンダリング相当のHTMLに変換して表示する（段落・`**強調**`・リスト・リンクを保持）。
- `## Skills` は見出し・説明文・箇条書きをそのまま表示する（タグ化はしない）。
- `## Timeline` をtimelineリストとして表示し、`### Certification` をその下にサブリストとして表示する。
- `## Link` の各項目をリンクリストとして表示する。Emailは既存の難読化方式（Base64＋クリックで復元）に合わせる。
- レイアウト・既存スタイルの命名規則は維持し、必要なクラスのみ追加する。

### ステップ3：トップページ（`src/components/home/UnderwaterSection.astro` の `#about` セクション）を更新する
- `.about-preview__text` の文章を `## About Me for top page` の内容に置き換える。
- ステップ1で抽出したスキルタグを `.about-preview__text` 内に一覧表示する（カテゴリごとにグループ化、またはフラットなタグリスト）。

### ステップ4：確認
- 変更箇所を簡潔に報告する（プロフィール・About Me・Skills・Timeline/Certification・Link・トップページタグのうち何を変更したか）。
- 必要であれば `npm run build` または dev サーバでの表示確認を提案する。

## メモ
- `## Link` のEmail以外の項目（contact.astro側のリンク先）を更新する場合は、対象が `src/pages/contact.astro` であることに注意する（about.astroとは別ファイル）。
- 下書き編集者はMarkdownの太字記法（`**語**`）でタグ化対象を明示すること。
