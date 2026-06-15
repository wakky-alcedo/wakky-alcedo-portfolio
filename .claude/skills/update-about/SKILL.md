update-about スキル

`docs/drafts/about.md` の下書きを `src/pages/about.astro` に反映するスキルです。
About ページの文章・スキル一覧・年表を、Markdownの下書きを編集するだけで更新できるようにします。

使い方
/update-about と入力して呼び出してください。

スキルの手順
以下の手順を順番に実行してください。

ステップ1：下書きを読む
`docs/drafts/about.md` を読み込みます。
- frontmatter の `name`：プロフィール名（`about-profile__name`）
- frontmatter の `skills`（`name` / `category` の配列）：`skills` 定数
- frontmatter の `timeline`（`year` / `event` の配列）：`timeline` 定数
- 本文（frontmatter以降）の各段落：プロフィール文（`about-profile__bio` 内の `<p>` 群）。段落数が変わった場合は `<p>` の数を増減させて合わせる。

ステップ2：差分を `src/pages/about.astro` に反映する
- `src/pages/about.astro` を読み、上記の対応箇所を下書きの内容で書き換える。
- `skills` / `timeline` の配列はオブジェクトの数・順序を下書きどおりに揃える（増減があれば追加・削除する）。
- レイアウト・スタイル（`<style>` ブロックやHTML構造）は変更しない。文言・データのみを更新する。

ステップ3：確認
- 変更箇所を簡潔に報告する（プロフィール文・スキル・年表のうち何を変更したか）。
- 必要であれば `npm run build` または dev サーバでの表示確認を提案する。

メモ
- 下書き編集者はYAML frontmatterの書式（インデント・コロン後の半角スペース）に注意すること。
- 年（`year`）は文字列として扱う（`"2022"` のようにクォートする）。
