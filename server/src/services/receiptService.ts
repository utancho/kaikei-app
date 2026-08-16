import { prisma } from "../lib/prisma.js";

export interface ReceiptExtraction {
  date: string | null; // YYYY-MM-DD
  vendorName: string | null;
  amount: number | null;
  description: string | null;
}

const PROMPT = `あなたは領収書・レシートの画像から情報を抽出するアシスタントです。
画像を見て、以下の項目をJSON形式のみで出力してください。前後に説明文は不要です。
{
  "date": "YYYY-MM-DD形式の日付。読み取れない場合はnull",
  "vendorName": "支払先の店舗名・会社名。読み取れない場合はnull",
  "amount": "合計金額(税込)を数値のみで。読み取れない場合はnull",
  "description": "何を購入したかの簡潔な説明。読み取れない場合はnull"
}`;

function extractJson(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export async function analyzeReceiptImage(ai: Ai, imageBytes: Uint8Array): Promise<ReceiptExtraction> {
  const result = await ai.run("@cf/llava-hf/llava-1.5-7b-hf", {
    prompt: PROMPT,
    image: Array.from(imageBytes),
    max_tokens: 512,
  });

  const responseText = (result as { description?: string }).description ?? "";
  const parsed = extractJson(responseText);
  if (!parsed) {
    return { date: null, vendorName: null, amount: null, description: null };
  }

  const dateRaw = typeof parsed.date === "string" ? parsed.date : null;
  const date = dateRaw && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
  const amountRaw = parsed.amount;
  const amount =
    typeof amountRaw === "number"
      ? Math.round(amountRaw)
      : typeof amountRaw === "string" && /^[\d,]+$/.test(amountRaw)
        ? Math.round(Number(amountRaw.replace(/,/g, "")))
        : null;

  return {
    date,
    vendorName: typeof parsed.vendorName === "string" ? parsed.vendorName : null,
    amount,
    description: typeof parsed.description === "string" ? parsed.description : null,
  };
}

// 抽出したベンダー名・説明文からよく使う経費科目を推測する(あくまで簡易ヒント)。
const KEYWORD_TO_CODE: [string[], string][] = [
  [["タクシー", "電車", "バス", "JR", "新幹線", "ガソリン", "駐車場", "高速", "航空", "ANA", "JAL"], "6110"],
  [["携帯", "電話", "インターネット", "プロバイダ", "切手", "郵便", "通信"], "6120"],
  [["電気", "ガス", "水道"], "6130"],
  [["書店", "本屋", "新聞", "雑誌", "Amazon", "楽天ブックス"], "6140"],
  [["文房具", "用紙", "インク", "トナー", "事務用品", "コピー"], "6150"],
  [["修理", "修繕"], "6170"],
  [["家賃", "地代"], "6180"],
  [["保険"], "6190"],
  [["広告", "宣伝"], "6080"],
  [["手数料", "振込"], "6220"],
  [["会議", "打ち合わせ", "カフェ", "喫茶"], "6100"],
  [["接待", "居酒屋", "レストラン", "懇親"], "6090"],
];

export async function suggestAccountId(businessId: string, text: string): Promise<string | null> {
  const normalized = text.toLowerCase();
  const matchedCode = KEYWORD_TO_CODE.find(([keywords]) => keywords.some((k) => normalized.includes(k.toLowerCase())))?.[1];
  if (!matchedCode) return null;

  const account = await prisma.account.findFirst({ where: { businessId, code: matchedCode, isActive: true } });
  return account?.id ?? null;
}
