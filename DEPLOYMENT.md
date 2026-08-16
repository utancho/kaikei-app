# デプロイ手順(Cloudflare Workers + D1、単一プロジェクト)

このアプリは**1つのCloudflare Worker**から、静的サイト(React)とAPI(Hono)の両方を
配信します。CloudflareのGitHub連携(Workers Builds)を使う場合、リポジトリのルートに
`wrangler.toml` があるので特別な設定は基本的に不要です。

- フロント・API とも同一オリジンなので、Cookieのcross-site対応(`SameSite=None`等)が不要
- Workers・D1 とも無料枠の範囲で動きます([Workers無料枠](https://developers.cloudflare.com/workers/platform/pricing/): 1日10万リクエストまで無料)

## Cloudflareダッシュボード(Workers Builds)の設定値

GitHub連携でこのリポジトリを接続した場合、プロジェクト設定は以下にしてください:

| 項目 | 値 |
|---|---|
| Root directory | `/`(リポジトリ直下のまま) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |

**重要:** Build commandは必ず `npm run build`(ワークスペース指定なしのルートコマンド)にしてください。
これは「クライアントをビルドする」だけでなく「サーバー側で `prisma generate` を実行してPrisma Clientを
生成する」処理も含んでいます。`npm run build --workspace=client` のようにクライアントだけをビルドすると、
Prisma Clientが未生成のまま `wrangler deploy` がバンドルしてしまい、デプロイ後にAPIが正しく動作しません
(Cloudflare Pagesはデフォルトでnpmのインストールスクリプトをブロックするため、`prisma generate` は
明示的にビルドコマンドの中で実行する必要があります)。

## 事前準備(初回のみ)

1. [Cloudflareアカウント](https://dash.cloudflare.com/sign-up)を作成(無料)。
2. ローカルでログイン: `npx wrangler login`
3. D1データベースを作成:
   ```bash
   npx wrangler d1 create kaikei-db
   ```
   出力される `database_id` を `wrangler.toml` の
   `database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` に反映してください。
4. 本番DBにスキーマを反映:
   ```bash
   npm run d1:migrations:apply:remote
   ```
5. シークレットを設定:
   ```bash
   npx wrangler secret put JWT_SECRET
   # 生成例: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Stripeを使う場合(任意、後からでもOK):
   ```bash
   npx wrangler secret put STRIPE_SECRET_KEY
   npx wrangler secret put STRIPE_PRICE_ID
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
6. `wrangler.toml` の `[vars]` にある `APP_URL` を、初回デプロイ後に判明する
   `https://<プロジェクト名>.<サブドメイン>.workers.dev` のようなURLに更新し、再デプロイしてください
   (Stripeのリダイレクト先として使われます。カスタムドメインを使うならそのURLでOK)。

## デプロイ

GitHub連携済みなら、`main` ブランチへのpushで自動的にビルド・デプロイされます。

手動でデプロイする場合:

```bash
npm run deploy
```

## Stripeのセットアップ(月額課金を有効にする場合)

1. [Stripe](https://stripe.com) にサインアップ(テストモードなら本人確認不要ですぐ使えます)。
2. ダッシュボードの **開発者 → APIキー** からテスト用シークレットキー(`sk_test_...`)を取得。
3. **商品カタログ** で月額プラン(例: ¥1,980/月、定期支払い)を作成し、Price ID(`price_...`)を取得。
4. **開発者 → Webhook** でエンドポイントを追加:
   - URL: `https://<あなたのWorkerのURL>/api/billing/webhook`
   - イベント: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. 取得した3つの値を上記の `wrangler secret put` で設定してください。
6. 本番で実際に課金するには、Stripeダッシュボードを「本番モード」に切り替え、
   本番用のキー・Webhookに差し替えてください(本人確認・銀行口座登録が必要です)。

ローカルでWebhookをテストする場合は [Stripe CLI](https://stripe.com/docs/stripe-cli) の
`stripe listen --forward-to localhost:4000/api/billing/webhook` が使えます。

## ローカル開発

```bash
npm install
cp .dev.vars.example .dev.vars   # JWT_SECRETを生成して設定
npm run d1:migrations:apply:local
npm run build:client             # client/dist を一度作っておく(wranglerのassets用)
npm run dev:server               # http://localhost:4000 (wrangler dev)
```

別ターミナルで:

```bash
npm run dev:client       # http://localhost:5173 (Vite、HMR付き。/api を :4000 にプロキシ)
```

普段の開発は `http://localhost:5173` を開いてください。`http://localhost:4000` に直接
アクセスすると本番同様に静的ビルド+APIが1つのWorkerから返りますが、HMRは効きません。

初回データ投入(`dev:server` 起動中に、別ターミナルで):

```bash
cd server && npm run prisma:seed
# 出力される wrangler d1 execute コマンドを実行してサブスクリプションをACTIVEにする
```

デモログイン: `demo@example.com` / `password123`

## トラブルシューティング

- **`Cannot find module '@prisma/client'` やモデルのプロパティが存在しないというTSエラーが出る**:
  Prisma Clientが未生成です。`cd server && npx prisma generate` を実行してください。
  CI上で起きる場合はBuild commandが `prisma generate` を含んでいるか確認してください。
- **`wrangler deploy` が "run in the root of a workspace" エラーになる**:
  `wrangler.toml` を見つけられていません。実行ディレクトリがリポジトリ直下になっているか確認してください。
