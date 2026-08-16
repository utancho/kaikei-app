import { prisma } from "../lib/prisma.js";
import { getBalanceSheet, getProfitAndLoss } from "./reportsService.js";

// 国税庁「青色申告決算書(一般用)」の経費区分を参考にした勘定科目コード→表示項目のマッピング。
// 対応するコードが無い項目は0円として表示され、どの科目にも当てはまらない費用は
// 「雑費」にまとめて集計される簡易版。正式な申告の際は内容を必ずご確認ください。
const EXPENSE_LINE_MAP: { key: string; label: string; codes: string[] }[] = [
  { key: "wages", label: "給料賃金", codes: ["6020", "6030"] },
  { key: "outsourcing", label: "外注工賃", codes: ["5020", "6060"] },
  { key: "welfare", label: "福利厚生費", codes: ["6040", "6050"] },
  { key: "travel", label: "旅費交通費", codes: ["6110"] },
  { key: "communication", label: "通信費", codes: ["6120"] },
  { key: "utilities", label: "水道光熱費", codes: ["6130"] },
  { key: "advertising", label: "広告宣伝費", codes: ["6080"] },
  { key: "entertainment", label: "接待交際費", codes: ["6090"] },
  { key: "insurance", label: "損害保険料", codes: ["6190"] },
  { key: "repair", label: "修繕費", codes: ["6170"] },
  { key: "supplies", label: "消耗品費", codes: ["6150", "6160"] },
  { key: "depreciation", label: "減価償却費", codes: ["6210"] },
  { key: "rent", label: "地代家賃", codes: ["6180"] },
  { key: "interest", label: "利子割引料", codes: ["7010"] },
  { key: "shipping", label: "荷造運賃", codes: ["6070"] },
  { key: "tax", label: "租税公課", codes: ["6200"] },
  { key: "badDebt", label: "貸倒金", codes: [] },
];

const MAPPED_CODES = new Set(EXPENSE_LINE_MAP.flatMap((l) => l.codes));
const SPECIAL_ALLOWANCE_CODE = "6011"; // 専従者給与

export async function getBlueReturnStatement(businessId: string, from: Date, to: Date) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const pl = await getProfitAndLoss(businessId, from, to);
  const bs = await getBalanceSheet(businessId, from, to);

  const expenseItems = pl.lineItems.filter((l) => l.category === "EXPENSE" && l.code !== SPECIAL_ALLOWANCE_CODE);

  const expenseLines = EXPENSE_LINE_MAP.map((line) => ({
    key: line.key,
    label: line.label,
    amount: expenseItems.filter((it) => line.codes.includes(it.code)).reduce((s, it) => s + it.amount, 0),
  }));

  const miscAmount = expenseItems.filter((it) => !MAPPED_CODES.has(it.code)).reduce((s, it) => s + it.amount, 0);
  expenseLines.push({ key: "misc", label: "雑費", amount: miscAmount });

  const expenseTotal = expenseLines.reduce((s, l) => s + l.amount, 0);

  const purchases = pl.lineItems.filter((l) => l.code === "5010").reduce((s, l) => s + l.amount, 0);
  const grossProfit = pl.summary.sales - purchases;
  const incomeBeforeDeductions = grossProfit - expenseTotal;

  const specialAllowanceWages = pl.lineItems
    .filter((l) => l.code === SPECIAL_ALLOWANCE_CODE)
    .reduce((s, l) => s + l.amount, 0);

  const incomeAfterWages = incomeBeforeDeductions - specialAllowanceWages;
  const appliedDeduction = Math.max(0, Math.min(business.blueReturnDeduction, Math.max(incomeAfterWages, 0)));
  const finalIncome = incomeAfterWages - appliedDeduction;

  return {
    business: { name: business.name, representativeName: business.representativeName },
    period: { from, to },
    sales: pl.summary.sales,
    purchases,
    grossProfit,
    expenseLines,
    expenseTotal,
    incomeBeforeDeductions,
    specialAllowanceWages,
    incomeAfterWages,
    blueReturnDeduction: appliedDeduction,
    finalIncome,
    balanceSheet: bs,
  };
}
