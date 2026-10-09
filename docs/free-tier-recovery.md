# 無料枠内のバックアップと復元確認

所有者は実務機能画面から事業者の業務 JSON を保存できます。原本証憑は `bytesBase64` に含まれ、ユーザーのパスワード・セッション秘密情報は含まれません。JSON は提出・移行用であり、アプリへの本番復元 API はありません。ダウンロードには帳簿・証憑の機密情報が含まれるため、アクセス制限された保存先を使用してください。

データベース全体の復元可能性は、ローカル QA D1 の SQL を書き出して隔離 SQLite に読み込み、全業務テーブルの行数・SHA-256・整合性を閉じて再接続した後に比較します。Wrangler が出力しない内部 `_cf_METADATA` と SQLite の `sqlite_*` は比較対象外として結果に明記します。検証中は QA の書き込みを停止してください。SQL と復元先は専用一時ディレクトリに作成され、終了後に削除されます。本番への書き込み・復元は行いません。

```powershell
python scripts/verify-backup-restore.py --self-test
python scripts/verify-backup-restore.py --persist-to .qa-app-db --database kaikei-db
```

2 番目のコマンドは QA の SQLite を読み取り専用接続で隔離一時領域にスナップショットし、`npx --no-install wrangler d1 export kaikei-db --local --config <一時設定> --output <一時SQL>` を実行します。Wrangler の export は `--persist-to` を受け付けないため、一時設定の既定保存先にコピーを置きます。専用 QA 保存先に D1 が複数存在する場合は中止します。元 DB は読み取り専用です。JSON 業務出力と SQL 全体バックアップは用途が異なり、この検証は SQL の復元を確認します。

本番は既存 Cloudflare D1 の Time Travel を利用できます。Cloudflare ダッシュボードで既存アカウントのプランと保持期間を読み取り確認し、復元候補日時・対象 DB・バックアップ保管状況を記録してください。この手順は復元操作を実行しません。Free の公表保持期間は 7 日ですが、契約の実態はダッシュボードで確認してください。既存 AI 利用など別機能の消費も無料と断定しません。

公式資料: https://developers.cloudflare.com/d1/reference/time-travel/ と https://developers.cloudflare.com/d1/wrangler-commands/#export

依存関係では Prisma 6.19.3 を維持し、再帰オブジェクトによるスタック枯渇 [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) の修正版 `deepmerge-ts` 8.0.0 を override で固定します。Prisma の設定読込と generate を検証した上で使用します。開発依存の残存 advisory は production audit とは別に評価します。

```powershell
node scripts/verify-prisma-config.mjs
npm run prisma:generate --workspace=server
npm audit --omit=dev
```

npm 11.6.1 はこの workspace の既存 lock では override を通常の install 時に再解決せず、`npm ls deepmerge-ts` は Prisma の元の要求 `7.1.5` に対する `invalid` を表示します。lock の対象 1 パッケージを公式 npm registry の 8.0.0 tarball/integrity に合わせて更新し、隔離ディレクトリの `npm ci --ignore-scripts --omit=optional` で 8.0.0 の再現を確認しました。元の依存要求を偽装したり Prisma を降格していません。lock を削除して再生成する際はこの制約を再検証してください。

Wrangler は 4.149.0（同 major の公式依存を含む）、Vite は 6.4.4 と互換の React plugin 4.7.0、source-map-js は 1.2.2 に更新しました。production audit は 0 件ですが、全依存 audit は Tailwind の開発依存に 7 件（high 5、moderate 2）を報告します。これは未修正として扱い、安全性の完全認証とはしません。

- high: `braces`, `chokidar`, `micromatch`, `fast-glob`, `tailwindcss`。根本の braces は公開最新版 3.0.3 も対象で、同 major の修正版がありません。深くネストした glob がビルド・監視プロセスを停止させるリスクです。
- moderate: `postcss-selector-parser`, `postcss-nested`。selector parser の修正版は 7.1.6 で、Tailwind 3 が要求する 6 系を越えます。悪意ある長い CSS selector によるビルド CPU 消費のリスクです。

これらは配信される会計 API の production 依存には含まれません。開発・ビルド環境で信頼しない glob/CSS を取り込まない運用が必要です。完全な依存 audit 解消には Tailwind 4 の設定/CSS 移行と画面検証、または上流の互換修正版が必要です。`npm audit fix --force` や、API 互換を未検証の major override は使用していません。
