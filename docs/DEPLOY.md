# デプロイ手順（Ubuntu + Docker + Cloudflare Tunnel）

本サイトは Docker（マルチステージビルド + nginx）でコンテナ化し、Cloudflare Tunnel経由で公開する。
サーバー側でポートを直接開放しない構成のため、ファイアウォールでの80/443開放は不要。

## 構成ファイル

| ファイル | 役割 |
|----------|------|
| [`Dockerfile`](../Dockerfile) | `node:22-alpine`でビルド → `nginx:1.27-alpine`で静的配信 |
| [`nginx.conf`](../nginx.conf) | 静的配信設定（キャッシュヘッダー等） |
| [`docker-compose.yml`](../docker-compose.yml) | `portfolio`（nginx）+ `cloudflared`の2サービス構成 |
| [`.env.example`](../.env.example) | `TUNNEL_TOKEN`のテンプレート |

---

## 1. Cloudflare Tunnel の作成

1. [Cloudflare Zero Trust ダッシュボード](https://one.dash.cloudflare.com/) にログイン
2. **Networking → Tunnels → Create a tunnel** を選択
3. トンネル名（例: `wakky-alcedo-portfolio`）を入力して作成
4. Setup Environment は，`Docker`を選択
5. Run tunnel with Docker 画面で表示される **トークン**（`TUNNEL_TOKEN=ey...` の値）をコピーして控える
   - Dockerでコンテナ起動するため、表示されたインストールコマンドは実行不要
1. 続けて **Routes** タブで以下を設定
   - **Add published application** を選択
   - **Subdomain / Domain**: 公開したいドメイン（例: `portfolio.example.com`）
   - **Service**: `http://portfolio:80`
     - `portfolio` は docker-compose内のサービス名で、cloudflaredコンテナと同じネットワーク上で名前解決される
6. 保存すると、対象ドメインのDNSにCloudflare管理のCNAMEが自動追加される

---

## 2. Ubuntuサーバーへのデプロイ

### 前提
- Docker / Docker Compose Plugin がインストール済みであること
  ```bash
  docker --version
  docker compose version
  ```

### 手順

1. リポジトリを取得
   ```bash
   git clone <repository-url>
   cd wakky-alcedo-portfolio
   ```

2. `.env` を作成し、手順1で取得したトークンを設定
   ```bash
   cp .env.example .env
   nano .env
   ```
   ```
   TUNNEL_TOKEN=ey...（Cloudflareダッシュボードで取得した値）
   ```

3. ビルド & 起動
   ```bash
   docker compose up -d --build
   ```

4. 起動確認
   ```bash
   docker compose ps
   docker compose logs -f cloudflared
   ```
   `cloudflared`のログに `Registered tunnel connection` が出れば接続成功。

5. ブラウザで Public Hostname に設定したドメイン（例: `https://portfolio.example.com`）にアクセスして表示確認

---

## 3. 更新時の再デプロイ

```bash
git pull
docker compose up -d --build
```

`cloudflared`側の再起動は不要（`portfolio`コンテナのみ再作成される）。

---

## 4. トラブルシュート

| 症状 | 確認事項 |
|------|----------|
| サイトにアクセスできない | `docker compose logs cloudflared` でトンネル接続状態を確認 |
| 502エラー | Public Hostnameの Service が `http://portfolio:80` になっているか確認（コンテナ名・ポート） |
| 画像/CSSが反映されない | `docker compose up -d --build` でイメージを再ビルドしたか確認（キャッシュが残っている場合は `docker compose build --no-cache`） |

---

## 参照
- [Cloudflare Tunnel公式ドキュメント](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [cloudflared Dockerイメージ](https://hub.docker.com/r/cloudflare/cloudflared)
