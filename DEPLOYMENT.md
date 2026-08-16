# デプロイ手順(Railway推奨)

このアプリはNode.js(Express)サーバーが、ビルド済みのReactクライアントとAPIを
同一オリジンから配信する構成です。Railwayは無料枠から始められ、Dockerfileを
自動検出してビルド・デプロイしてくれるため、この構成に向いています。

## 事前準備

1. [Railway](https://railway.app) にサインアップし、GitHubアカウントと連携する。
2. このリポジトリをGitHub上にプッシュする(まだの場合)。
   ```bash
   git remote add origin <あなたのGitHubリポジトリURL>
   git push -u origin main
   ```

## Railwayでのセットアップ

1. Railwayダッシュボードで **New Project → Deploy from GitHub repo** を選択し、
   このリポジトリを選ぶ。
2. Railwayが `Dockerfile` を自動検出してビルドを開始します(`railway.json` 済み)。
3. **Variables** タブで以下の環境変数を設定してください。

   | 変数名 | 説明 |
   |---|---|
   | `JWT_SECRET` | ランダムな文字列。`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` で生成 |
   | `APP_URL` | 公開後のURL(例: `https://your-app.up.railway.app`)。デプロイ後に判明するので後から設定してOK |
   | `DATABASE_URL` | `file:/data/prod.db`(下記ボリューム設定と合わせる) |
   | `STRIPE_SECRET_KEY` | Stripeのシークレットキー(課金機能を使う場合) |
   | `STRIPE_PRICE_ID` | 月額プランのPrice ID(課金機能を使う場合) |
   | `STRIPE_WEBHOOK_SECRET` | Webhook署名シークレット(課金機能を使う場合) |

4. **データを永続化するため、ボリュームを追加**してください
   (Settings → Volumes → New Volume)。マウントパスは `/data` に設定します。
   SQLiteのファイルをこの中に置くことで、再デプロイしてもデータが消えません。

5. デプロイが完了したら発行されたURLにアクセスし、動作を確認してください。

> **将来的な改善案:** 現状はSQLite+ボリュームで動かしていますが、アクセスが増えてきたら
> RailwayのPostgresアドオンに切り替えることを推奨します。切り替えは
> `server/prisma/schema.prisma` の `datasource` の `provider` を `"postgresql"` に変更し、
> `DATABASE_URL` をRailwayが発行するPostgres接続文字列に差し替えるだけです
> (このスキーマはSQLite固有の記法を使っていないため、他の変更は不要です)。

## Stripeのセットアップ(月額課金を有効にする場合)

1. [Stripe](https://stripe.com) にサインアップ(テストモードなら本人確認不要ですぐ使えます)。
2. ダッシュボードの **開発者 → APIキー** から、テスト用のシークレットキー
   (`sk_test_...`)を取得し、`STRIPE_SECRET_KEY` に設定。
3. **商品カタログ** で月額プラン(例: ¥1,980/月、定期支払い)を作成し、
   発行された **Price ID**(`price_...`)を `STRIPE_PRICE_ID` に設定。
4. **開発者 → Webhook** でエンドポイントを追加:
   - URL: `https://<あなたのAPP_URL>/api/billing/webhook`
   - 送信するイベント: `checkout.session.completed`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - 発行された署名シークレット(`whsec_...`)を `STRIPE_WEBHOOK_SECRET` に設定。
5. 本番で実際に課金を開始する場合は、Stripeダッシュボードを「本番モード」に切り替え、
   本番用のキー・Webhookに差し替えてください(本人確認・銀行口座登録が必要です)。

ローカルでWebhookをテストしたい場合は [Stripe CLI](https://stripe.com/docs/stripe-cli) の
`stripe listen --forward-to localhost:4000/api/billing/webhook` が使えます。

## ローカルでのDocker動作確認(推奨)

このDockerfileは開発環境にDockerがなかったため未検証です。デプロイ前に一度、
手元で以下を実行して起動することを強くおすすめします。

```bash
docker build -t kaikei .
docker run -p 4000:4000 \
  -e JWT_SECRET=test-secret \
  -e DATABASE_URL="file:/app/server/prisma/dev.db" \
  -e APP_URL="http://localhost:4000" \
  kaikei
```
