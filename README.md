# Kaikei - 会計ソフト

freee等を参考にした、複式簿記ベースの会計SaaSです。個人事業主・法人の両方に対応し、
メール認証・Stripeによる月額課金・マルチテナント分離を備えています。
Cloudflareの無料枠(Pages + Workers + D1)だけでホスティングできる構成です。

## 構成

- `server/` — Cloudflare Workers上で動くAPI(Hono + Prisma + D1)
- `client/` — React + Vite + Tailwind CSS のフロントエンド(Cloudflare Pagesで配信)

ローカル開発では Vite Dev Server (`:5173`) が `wrangler dev` (`:4000`) にAPIリクエストを
プロキシします。本番ではPages(静的サイト)とWorkers(API)を別々にデプロイします
(詳細は [DEPLOYMENT.md](DEPLOYMENT.md))。

## 主な機能

### 会計機能
- 初回セットアップウィザード(事業形態→基本情報→消費税区分→確認の4ステップ)
- 事業者管理(個人事業主 / 法人、複数事業者切り替え)
- 勘定科目マスタ(freee準拠の標準科目を自動セットアップ、追加・無効化可能)
- 仕訳入力(複式簿記、貸借バランスの自動検証)・複製・テンプレート
- 家事按分(個人事業主向け。経費を事業按分率で分割し、自動的に事業主貸へ振替)
- 取引先マスタ・取引先別残高一覧(売掛金・買掛金)
- ダッシュボード(現預金推移・費用内訳・月次推移表)
- 総勘定元帳・合計残高試算表・損益計算書・貸借対照表
- 請求書作成(インボイス制度対応)・仕訳への計上・入金消込・印刷/PDF出力
- 銀行/カード明細CSV取込(勘定科目の自動提案)
- 固定資産台帳(定額法・定率法の減価償却費を自動計算し、期末に仕訳計上)
- 青色申告決算書(参考フォーマット、印刷/PDF出力対応)
- 各種帳票のCSVエクスポート

### アカウント・課金
- メールアドレス+パスワードによるサインアップ/ログイン(JWTセッションCookie)
- 事業者データはログインユーザーごとに分離(他ユーザーのデータには一切アクセス不可)
- Stripeによる月額サブスクリプション(14日間無料トライアル、Billing Portal連携)
- 未ログイン時に表示するランディングページ

## セットアップ(ローカル開発)

```bash
npm install
cd server && cp .dev.vars.example .dev.vars   # JWT_SECRETを生成して設定
npm run d1:migrations:apply:local              # ローカルD1にスキーマ反映
```

## 起動

```bash
npm run dev:server   # http://localhost:4000 (wrangler dev / Workers)
npm run dev:client   # http://localhost:5173 (Vite)
```

別ターミナルで初回データ投入(`dev:server` 起動中に実行):

```bash
cd server
npm run prisma:seed
# 出力される wrangler d1 execute コマンドを実行するとサブスクリプションがACTIVEになります
```

ブラウザで `http://localhost:5173` を開いてください(デモログイン: `demo@example.com` / `password123`)。
Stripeの `STRIPE_SECRET_KEY` 等を設定しない場合、会計機能はそのまま使えますが
決済(課金)機能は「準備中」として無効化されます。

## デプロイ

[DEPLOYMENT.md](DEPLOYMENT.md) にCloudflare Pages / Workers / D1 へのデプロイ手順と
Stripeの設定手順をまとめています。

## 今後の拡張候補

- カスタムドメインでPages/Workersを同一ドメイン配下にまとめ、Cookieのcross-site設定を簡略化
- 消費税申告書・法人税申告書の書式出力
- 請求書のメール送信
- 事業者ごとのメンバー招待(現状は1ユーザー=複数事業者だが、共同編集は未対応)
