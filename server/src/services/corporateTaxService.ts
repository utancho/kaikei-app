import { prisma } from "../lib/prisma.js";
import { getProfitAndLoss } from "./reportsService.js";

// 中小法人向けの概算パラメータ(参考値)。実際の申告では最新の税率・軽減措置・
// 地方自治体ごとの税率、税務調整(加算・減算)を反映して計算し直すこと。
const REDUCED_THRESHOLD = 8_000_000; // 軽減税率の対象(所得年800万円以下)
const CORP_REDUCED_RATE = 0.15; // 法人税 軽減税率
const CORP_STANDARD_RATE = 0.232; // 法人税 標準税率
const LOCAL_CORP_RATE = 0.103; // 地方法人税(法人税額に対して)
const INHABITANT_RATE = 0.07; // 法人住民税 法人税割(概算・都道府県+市町村)
const INHABITANT_PER_CAPITA = 70_000; // 均等割(資本金1000万以下・従業員50人以下の標準)
const ENTERPRISE_RATE = 0.07; // 法人事業税(所得割・特別法人事業税込みの概算)

const round = (n: number) => Math.round(n);
// 率(%)は浮動小数の誤差を避けて小数1桁に丸める(例: 0.232*100 = 23.200000000000003)。
const pct = (rate: number) => Math.round(rate * 1000) / 10;

/**
 * 法人税等の概算(参考フォーマット)。税引前当期純利益を課税所得とみなし、
 * 中小法人の標準的な税率で法人税・地方法人税・住民税・事業税を概算する。
 */
export async function getCorporateTaxReturn(businessId: string, from: Date, to: Date) {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const pl = await getProfitAndLoss(businessId, from, to);

  const pretaxIncome = pl.summary.incomeBeforeTax;
  const taxableIncome = Math.max(0, pretaxIncome);

  const reducedBase = Math.min(taxableIncome, REDUCED_THRESHOLD);
  const standardBase = Math.max(0, taxableIncome - REDUCED_THRESHOLD);
  const corpReduced = round(reducedBase * CORP_REDUCED_RATE);
  const corpStandard = round(standardBase * CORP_STANDARD_RATE);
  const corporateTax = corpReduced + corpStandard;

  const localCorporateTax = round(corporateTax * LOCAL_CORP_RATE);
  const inhabitantLevy = round(corporateTax * INHABITANT_RATE);
  const inhabitantPerCapita = INHABITANT_PER_CAPITA;
  const inhabitantTotal = inhabitantLevy + inhabitantPerCapita;
  const enterpriseTax = round(taxableIncome * ENTERPRISE_RATE);

  const totalTax = corporateTax + localCorporateTax + inhabitantTotal + enterpriseTax;
  const effectiveRate = taxableIncome > 0 ? (totalTax / taxableIncome) * 100 : null;

  return {
    business: { name: business.name, type: business.type },
    period: { from, to },
    pretaxIncome,
    taxableIncome,
    corporateTax: {
      reducedBase,
      reducedRate: pct(CORP_REDUCED_RATE),
      reducedAmount: corpReduced,
      standardBase,
      standardRate: pct(CORP_STANDARD_RATE),
      standardAmount: corpStandard,
      total: corporateTax,
    },
    localCorporateTax: { rate: pct(LOCAL_CORP_RATE), amount: localCorporateTax },
    inhabitantTax: {
      corporateTaxLevyRate: pct(INHABITANT_RATE),
      corporateTaxLevy: inhabitantLevy,
      perCapita: inhabitantPerCapita,
      total: inhabitantTotal,
    },
    enterpriseTax: { rate: pct(ENTERPRISE_RATE), amount: enterpriseTax },
    totalTax,
    effectiveRate,
  };
}
