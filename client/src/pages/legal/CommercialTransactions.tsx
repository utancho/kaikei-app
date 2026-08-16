import { LegalLayout } from "./LegalLayout";

const ROWS: [string, string][] = [
  ["販売事業者", "鈴木 ※要フルネーム(下記参照)"],
  ["運営統括責任者", "鈴木 ※要フルネーム(下記参照)"],
  ["所在地", "ご請求をいただいた場合には、遅滞なく開示いたします。"],
  ["電話番号", "ご請求をいただいた場合には、遅滞なく開示いたします。"],
  ["メールアドレス", "suzukishion522@icloud.com"],
  ["販売価格", "スタンダードプラン ¥1,980 / 月(税込)"],
  ["商品代金以外の必要料金", "インターネット接続に伴う通信費はお客様のご負担となります。"],
  ["お支払い方法", "クレジットカード決済(Stripe)"],
  ["お支払い時期", "初回登録時に決済し、以降は毎月同日に自動更新・課金されます。"],
  ["サービス提供時期", "決済完了後、直ちにご利用いただけます。"],
  [
    "返品・キャンセルについて",
    "本サービスはソフトウェアの利用権を提供する性質上、役務提供開始後の返金には原則応じられません。解約はマイページからいつでも可能で、解約後は次回更新日以降の請求は発生しません。初回登録から14日間は無料トライアル期間です。",
  ],
];

export default function CommercialTransactions() {
  return (
    <LegalLayout title="特定商取引法に基づく表示" updatedAt="2026年8月17日">
      <p>
        特定商取引法に基づき、以下のとおり表示いたします。
        <br />
        <span className="text-amber-600 font-medium">
          ※このページは運営者情報の入力が一部未完了です。事業者名(フルネーム)・所在地・電話番号を確定のうえ公開してください。
        </span>
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {ROWS.map(([label, value]) => (
            <tr key={label} className="border-t border-gray-100 first:border-t-0">
              <th className="text-left align-top py-3 pr-4 w-40 shrink-0 font-medium text-gray-500 whitespace-nowrap">{label}</th>
              <td className="py-3 text-gray-800">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </LegalLayout>
  );
}
