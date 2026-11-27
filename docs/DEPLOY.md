# デプロイ手順（Cloudflare）

ビルドした静的ファイル（`dist/`）を Cloudflare の Workers & Pages で配信する。
Cloudflare 上の名前は `wakky-alcedo-portfolio`（Workers の静的アセット配信。Worker のコードはない）。
公開 URL は `https://alcedoworks.com`（`astro.config.mjs` の `site` と合わせる）。

## 構成ファイル

| ファイル | 役割 |
|----------|------|
| [`wrangler.jsonc`](../wrangler.jsonc) | プロジェクト名と配信するディレクトリ（`assets.directory: ./dist`） |

## 公開の流れ

GitHub（`wakky-alcedo/wakky-alcedo-portfolio`）の `main` に push すると，Cloudflare の Workers Builds がビルドして公開する。

| 項目 | 値 |
|------|----|
| ビルドコマンド | `npm run build` |
| デプロイコマンド | `npx wrangler deploy`（既定値） |

`unpublished: true` の記事は build に含まれないので，push しても公開されない（`src/lib/collections.ts`）。

## 初回設定（作り直すとき）

1. Cloudflare ダッシュボードの **Workers & Pages** で，GitHub リポジトリを接続して Worker を作る（[Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)）
2. ビルドコマンド・デプロイコマンドを上の表のとおりにする（[Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)）
3. **Settings → Domains & Routes** でカスタムドメイン `alcedoworks.com` を追加する（[Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)）

## 手元から公開する（Workers Builds を使わないとき）

```bash
npm run build
npx wrangler deploy
```

初回は `npx wrangler login` で Cloudflare にログインする。

## 参照

- [Astro を Cloudflare Workers で配信する](https://developers.cloudflare.com/workers/framework-guides/web-apps/astro/)
- [Workers の静的アセット](https://developers.cloudflare.com/workers/static-assets/)
