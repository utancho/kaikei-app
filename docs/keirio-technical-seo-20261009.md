# KEIRIO HUB 技術SEO修正（2026-10-09）

## 実測と原因の区別

本番を読み取り専用で調査した結果、`/not-a-real-keirio-page` が共通トップ用HTMLで200を返していた。`/legal/privacy` も共通タイトル・本文なしのHTMLで200だった。存在しない記事は404だった。

本番 sitemap.xml は200・application/xml、掲載12URL。HTTPからHTTPSへ301。robots.txtにはCloudflare Managed Contentが追加されている。通常のGooglebotに対する禁止は今回の確認範囲では見つからなかったが、User-Agentを変更した取得は本物のGooglebotによる取得の証明ではない。

Search Consoleの「取得できませんでした」の正確な理由・対象ソフト404一覧・最終取得日時は未取得。WAFログ、Verified Bot設定、Google側のライブテストにもアクセスしていない。200応答だけでSearch Consoleの問題解決とは判定しない。

## 修正内容

- Cloudflareの無条件SPAフォールバックを無効化。Workerで既存会計ルートを限定的にSPA配信し、未知URLは本当の404とする。APIの未知ルートもJSON 404。
- API、認証、Stripe処理、ユーザーデータ、DBスキーマは変更しない。本タスクのDB操作・デプロイは実施しない。
- 法的3ページは既存Reactコンポーネントからビルド時にHTML生成。条文を別コピーで保守せず、既存UIを維持しながらJavaScriptなしでも本文を配信する。
- 法的ページ・編集方針・ブログの個別タイトル、canonical、index/noindex、構造化データを整合。未存在記事のSPA表示もnoindex。
- サイトマップは公開静的6ページ＋実際の公開記事のみ。未公開・私有画面を含めない。日付は記事の実際の更新日時。
- 既知ページ末尾スラッシュを301で正規化。クエリは保持し、canonicalには含めない。
- robots.txtの `/api/` 禁止は維持しつつ、表示に必要な公開 `/api/blog` を許可。私有HTMLはクロール可能にしてnoindexを読み取れるようにする。robots.txtは認証やアクセス制御ではない。
- インデックス用HTMLの取得失敗は503とRetry-Afterを返す。空の成功ページへ変換しない。

## 検証

- サーバー全27テスト成功（仕訳締め、権限、セッション、入金処理の既存回帰テストを含む）。
- クライアント／サーバーの本番ビルド成功。既存ThreeUI CSSの旧gradient構文、500KB超チャンク、Prisma設定非推奨警告は残る。正規ソースや無関係な設定は変更しない。
- ローカル公開16URL（公開記事10本＋静的6ページ）を通常UA・Googlebot UAで確認：200、固有canonical、H1ひとつ、index可能。
- 未知ページ、未知法的ページ、未知記事、欠落JSは404。私有画面は200＋X-Robots-Tag:noindex。末尾スラッシュ301、サイトマップHEAD 200。
- Playwrightの390px表示：法的本文・記事・404の横はみ出しなし、pageerrorなし。記事のDOMにBlogPosting＋BreadcrumbListを確認。
- 会計APIをブロックしても公開ブログAPIが許可されれば記事本文を表示でき、編集方針への画面内遷移でタイトルが更新されることを確認。未存在記事はnoindex。
- 未認証の保護APIは401を維持。実決済、認証情報送信、有料API呼出しはしない。

再現：`npm run build` → ローカルWorker起動 → `node scripts/check-public-seo.mjs`。任意の取得先を引数で指定できる読み取り専用チェック。Wranglerを直接実行する前も、法的ページ生成のためルートの `npm run build` を実行する。

## 本番反映後に必要な確認（未実施）

1. 明示的なデプロイ許可を得てビルド済みWorker・assetsを同時反映する。DB移行は不要。
2. 本番で `node scripts/check-public-seo.mjs https://keirio-hub.com` を実行する。
3. Search Consoleで sitemap.xml の最終取得日時・詳細エラーを確認し、同じ正規URLを再送信する。公開記事／法的ページのURL検査でライブテストとレンダリングを確認する。
4. 実際のソフト404対象URLを分類：存在しないURLは404のまま、存在するURLは本文・JS読込・WAFを確認。全URLをトップへリダイレクトしない。
5. CloudflareのVerified Bot・WAF・チャレンジ・レート制限のイベントを、実際のGooglebotアクセス時刻と照合する。検証せずセキュリティを一括解除しない。
6. Googleの再クロールとレポート更新を待つ。登録・順位を保証しない。Search Consoleへのログイン・送信・検証リクエストは今回行っていない。

## ロールバック

本タスクの公開SEOルーティング、assets設定、生成スクリプト、robots変更のみをレビューして戻し、変更前Worker＋assetsを同時再デプロイする。作業ツリーには従来から多数の変更があるため、`git reset --hard` や一括破棄は使わない。DBロールバックは不要。

参考：[Google クロール問題の診断](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)、[JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)。
