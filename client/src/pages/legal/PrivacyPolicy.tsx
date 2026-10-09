import { LegalLayout } from "./LegalLayout";

export default function PrivacyPolicy() {
  return (
    <LegalLayout title="プライバシーポリシー" updatedAt="2026年10月9日">
      <p>
        Kaikei(以下「本サービス」といいます)は、お客様の個人情報の重要性を認識し、以下のとおりプライバシーポリシー(以下「本ポリシー」といいます)を定め、個人情報の保護に努めます。
      </p>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">1. 取得する情報</h2>
        <p>本サービスは、以下の情報を取得します。</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>アカウント登録時にご入力いただくメールアドレス・氏名・パスワード（パスワードはハッシュ化して保存します）</li>
          <li>お客様が入力される会計データ(仕訳・請求書・取引先情報等)</li>
          <li>決済処理のために決済代行会社(Stripe, Inc.)へお渡しする情報、および同社から通知される決済状況</li>
          <li>サービス利用状況に関するログ情報(アクセス日時等)</li>
          <li>レシート読取機能を利用した場合に送信される画像およびその読取結果</li>
          <li>利用者が保存する証憑原本、ファイル名、紐付け先、およびファイルの照合用ハッシュ</li>
          <li>変更履歴、レビューコメント、メール確認状態、ログイン端末情報（User-Agent）および通知の確認状態</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">2. 利用目的</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>本サービスの提供・維持・改善のため</li>
          <li>ご本人確認、認証のため</li>
          <li>料金請求・決済処理のため</li>
          <li>お問い合わせへの対応のため</li>
          <li>利用規約に違反する行為への対応のため</li>
        </ul>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">3. 第三者提供・委託</h2>
        <p>
          本サービスは、法令に基づく場合を除き、あらかじめお客様の同意を得ることなく第三者に個人情報を提供しません。ただし、決済処理は決済代行会社であるStripe,
          Inc.に委託しており、決済に必要な範囲の情報が同社に送信されます。Stripe社における取扱いについては、同社のプライバシーポリシーをご確認ください。
        </p>
        <p className="mt-3">本サービスの配信・データ保存にはCloudflareを利用しています。無料枠運用では外部AIの自動読取を停止し、過去の仕訳との照合および手入力を提供します。AI読取を有効にする場合は利用者が送信する画像をCloudflare Workers AIへ送信します。メール配信が設定されている場合、本人確認等の配信に必要なメールアドレスと本文をResendへ送信します。</p>
        <p className="mt-3">事業者のオーナーが許可した共有先は、その権限に応じて会計データ・証憑・レビューを閲覧します。共有を解除しても、解除前に共有先が保存したファイルまで回収することはできません。</p>
        <p className="mt-3"><a href="https://stripe.com/jp/privacy" target="_blank" rel="noreferrer">Stripeのプライバシーポリシー ↗</a> ／ <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">Cloudflareのプライバシーポリシー ↗</a> ／ <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noreferrer">Resendのプライバシーポリシー ↗</a></p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">4. Cookieの利用</h2>
        <p>
          本サービスは、ログイン状態を維持するために必要最小限のCookie(セッションCookie)を使用します。このCookieは本サービスの動作に必須であり、広告目的のトラッキングには使用しません。
        </p>
        <p className="mt-3">また、事業者の選択状態や月次タスクのチェック状態を、お使いのブラウザのローカルストレージへ保存します。月次タスクは端末間で同期されず、ブラウザの保存データを削除すると失われます。配信基盤のCloudflareではセキュリティ対策およびWeb Analyticsによる閲覧・表示性能の集計が行われます。Web AnalyticsはCookieを利用しない集計機能です。</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">5. 安全管理措置</h2>
        <p>本サービスは、取得した個人情報の漏えい・滅失・毀損の防止その他の安全管理のために、パスワードのハッシュ化、通信の暗号化(HTTPS)等の適切な措置を講じます。</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">6. 開示・訂正・削除等の請求</h2>
        <p>お客様は、本サービスが保有する自己の個人情報について、開示・訂正・削除等を請求することができます。ご希望の場合は下記のお問い合わせ窓口までご連絡ください。</p>
        <p className="mt-3">変更履歴は履歴保全のため通常の画面から編集・削除できません。証憑を非表示にしても、原本は業務JSONの出力対象として保管される場合があります。保存期間や削除のご希望は窓口までお問い合わせください。業務JSONには機密情報が含まれるため、保存先のアクセス制限をご確認ください。</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">7. 本ポリシーの改定</h2>
        <p>本サービスは、必要に応じて本ポリシーを改定することがあります。重要な変更がある場合は、本サービス上での掲示等、適切な方法でお知らせします。</p>
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-2">8. お問い合わせ窓口</h2>
        <p>本ポリシーに関するお問い合わせは、下記までご連絡ください。</p>
        <p className="mt-2">メールアドレス: suzukishion522@icloud.com</p>
      </section>
    </LegalLayout>
  );
}
