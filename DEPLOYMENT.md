# デプロイ手順(Cloudflare Pages + Workers + D1)

このアプリはCloudflareの無料枠だけで動く構成です。

- **フロントエンド**: Cloudflare Pages(Reactの静的ビルド)
- **API**: Cloudflare Workers(Hono)
- **DB**: Cloudflare D1(SQLite互換のエッジDB)

Pages・Workers・D1はいずれも無料枠が用意されており、この規模のアプリであれば
基本的に料金は発生しません([Workers無料枠](https://developers.cloudflare.com/workers/platform/pricing/): 1日10万リクエストまで無料)。

## 事前準備

1. [Cloudflareアカウント](https://dash.cloudflare.com/sign-up)を作成(無料)。
2. ローカルでCloudflareにログイン:
   ```bash
   cd server
   npx wrangler login
   ```
   ブラウザが開くので、アカウントへのアクセスを許可してください。

## 1. D1データベースの作成

```bash
cd server
npx wrangler d1 create kaikei-db
```

出力される `database_id` をコピーし、`server/wrangler.toml` の
`database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"` を書き換えてください。

本番DBにスキーマを反映します:

```bash
npm run d1:migrations:apply:remote
```

## 2. シークレットの設定(Workers)

```bash
npx wrangler secret put JWT_SECRET
# プロンプトが出たらランダムな文字列を入力
# 生成例: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Stripeの月額課金を使う場合(任意、後から設定してもOK):

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_PRICE_ID
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

`server/wrangler.toml` の `[vars]` にある `APP_URL` は、後述のPagesデプロイで
発行されるURLに合わせて更新してください(先にAPIだけ仮デプロイしてから
Pagesを作り、判明したURLで更新→再デプロイ、という順序で問題ありません)。

## 3. APIをWorkersにデプロイ

```bash
cd server
npm run deploy
```

`https://kaikei-api.<あなたのサブドメイン>.workers.dev` のようなURLが発行されます。

## 4. フロントエンドをPagesにデプロイ

```bash
cd client
echo 'VITE_API_BASE_URL="https://kaikei-api.<あなたのサブドメイン>.workers.dev"' > .env.production.local
npm run build
npx wrangler pages deploy dist --project-name=kaikei-app
```

初回はプロジェクト作成の確認が出ます。発行されたURL(`https://kaikei-app.pages.dev`等)を
`server/wrangler.toml` の `APP_URL` に設定し、`cd server && npm run deploy` で再デプロイしてください
(Stripeのリダイレクト先・CORS許可オリジンとして使われます)。

GitHubと連携して自動デプロイしたい場合は、Cloudflareダッシュボードの
Pages画面から「Gitに接続」でこのリポジトリを選び、ビルド設定を
`Build command: npm run build --workspace=client` / `Build output directory: client/dist` にしてください。

## 5. Stripeのセットアップ(月額課金を有効にする場合)

1. [Stripe](https://stripe.com) にサインアップ(テストモードなら本人確認不要ですぐ使えます)。
2. ダッシュボードの **開発者 → APIキー** からテスト用シークレットキー(`sk_test_...`)を取得。
3. **商品カタログ** で月額プラン(例: ¥1,980/月、定期支払い)を作成し、Price ID(`price_...`)を取得。
4. **開発者 → Webhook** でエンドポイントを追加:
   - URL: `https://kaikei-api.<あなたのサブドメイン>.workers.dev/api/billing/webhook`
   - イベント: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
5. 取得した3つの値を上記の `wrangler secret put` で設定してください。
6. 本番で実際に課金するには、Stripeダッシュボードを「本番モード」に切り替え、
   本番用のキー・Webhookに差し替えてください(本人確認・銀行口座登録が必要です)。

ローカルでWebhookをテストする場合は [Stripe CLI](https://stripe.com/docs/stripe-cli) の
`stripe listen --forward-to localhost:4000/api/billing/webhook` が使えます。

## ローカル開発

```bash
npm install
cd server && cp .dev.vars.example .dev.vars   # JWT_SECRETを編集
npm run d1:migrations:apply:local
npm run dev              # Workers版APIサーバー(http://localhost:4000)
```

別ターミナルで:

```bash
npm run dev:client       # http://localhost:5173
```

初回データ投入(別ターミナルで、`npm run dev` 起動中に):

```bash
cd server
npm run prisma:seed
# 出力される wrangler d1 execute コマンドを実行してサブスクリプションをACTIVEにする
```

デモログイン: `demo@example.com` / `password123`

## 今後の拡張候補

- カスタムドメインを設定し、Pages/Workersを同一ドメイン配下(例: `app.example.com` /
  `app.example.com/api`)にまとめると、Cookieのcross-site設定(`SameSite=None`)が不要になります。
- Stripe本番運用時は、Webhookの再送・冪等性なども考慮した運用体制を検討してください。
