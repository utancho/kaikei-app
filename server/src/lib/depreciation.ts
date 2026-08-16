// 減価償却費の月次スケジュール計算。
//
// 定額法は国税庁の計算方法(取得価額-残存価額を耐用年数で按分、月割)に準拠。
// 定率法は200%定率法の年率(2/耐用年数)を用いた簡易計算で、本来必要な
// 保証率・改定償却率のテーブルは使用していない近似値。実際の申告では
// 国税庁の耐用年数表・償却率表で計算し直すことを前提とする。

export interface DepreciationMonth {
  date: Date; // その月の月末相当(計算上のインデックス)
  depreciation: number;
  bookValueEnd: number;
}

export type DepreciationMethod = "STRAIGHT_LINE" | "DECLINING_BALANCE";

function addMonths(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function generateStraightLineSchedule(
  cost: number,
  residual: number,
  usefulLifeYears: number,
  acquisitionDate: Date
): DepreciationMonth[] {
  const totalMonths = usefulLifeYears * 12;
  const totalDepreciable = cost - residual;
  const monthlyAmount = Math.floor(totalDepreciable / totalMonths);

  const months: DepreciationMonth[] = [];
  let bookValue = cost;
  let accumulated = 0;
  for (let i = 0; i < totalMonths; i++) {
    const date = addMonths(acquisitionDate, i);
    const isLast = i === totalMonths - 1;
    const dep = isLast ? totalDepreciable - accumulated : monthlyAmount;
    accumulated += dep;
    bookValue -= dep;
    months.push({ date, depreciation: dep, bookValueEnd: bookValue });
  }
  return months;
}

function generateDecliningBalanceSchedule(
  cost: number,
  residual: number,
  usefulLifeYears: number,
  acquisitionDate: Date
): DepreciationMonth[] {
  const totalMonths = usefulLifeYears * 12;
  const annualRate = Math.min(2 / usefulLifeYears, 1);

  const months: DepreciationMonth[] = [];
  let bookValue = cost;
  for (let i = 0; i < totalMonths; i++) {
    const date = addMonths(acquisitionDate, i);
    const isLast = i === totalMonths - 1;
    const remainingMonths = totalMonths - i;
    const remainingDepreciable = bookValue - residual;

    if (isLast) {
      const dep = remainingDepreciable;
      bookValue -= dep;
      months.push({ date, depreciation: dep, bookValueEnd: bookValue });
      continue;
    }

    const decliningAmount = Math.floor((bookValue * annualRate) / 12);
    // 定率法の償却額が「残存年数で均等償却した場合」を下回ったら定額法に切り替える簡易ロジック
    const straightLineRemainder = Math.floor(remainingDepreciable / remainingMonths);
    const dep = Math.max(0, Math.min(Math.max(decliningAmount, straightLineRemainder), remainingDepreciable));

    bookValue -= dep;
    months.push({ date, depreciation: dep, bookValueEnd: bookValue });
  }
  return months;
}

export function generateDepreciationSchedule(params: {
  method: DepreciationMethod;
  acquisitionCost: number;
  residualValue: number;
  usefulLifeYears: number;
  acquisitionDate: Date;
}): DepreciationMonth[] {
  const { method, acquisitionCost, residualValue, usefulLifeYears, acquisitionDate } = params;
  if (acquisitionCost <= residualValue || usefulLifeYears <= 0) return [];
  return method === "DECLINING_BALANCE"
    ? generateDecliningBalanceSchedule(acquisitionCost, residualValue, usefulLifeYears, acquisitionDate)
    : generateStraightLineSchedule(acquisitionCost, residualValue, usefulLifeYears, acquisitionDate);
}

export function sumDepreciationInRange(schedule: DepreciationMonth[], from: Date, to: Date): number {
  return schedule
    .filter((m) => m.date >= from && m.date <= to)
    .reduce((sum, m) => sum + m.depreciation, 0);
}
