import type { AccountCategory, BusinessType, NormalBalance } from "./enums.js";
import { normalBalanceForCategory } from "./enums.js";

export interface DefaultAccountDef {
  code: string;
  name: string;
  category: AccountCategory;
  subcategory: string;
  normalBalance: NormalBalance;
  defaultTaxCategoryCode?: string;
}

// freee等の標準的な勘定科目体系を参考にした、個人事業主・法人共通のデフォルト科目セット。
// 純資産(資本)の部のみ個人/法人で構成が異なる。

const ASSET_ACCOUNTS: [string, string, string][] = [
  ["1010", "現金", "流動資産"],
  ["1020", "小口現金", "流動資産"],
  ["1030", "普通預金", "流動資産"],
  ["1040", "当座預金", "流動資産"],
  ["1050", "定期預金", "流動資産"],
  ["1110", "売掛金", "流動資産"],
  ["1120", "受取手形", "流動資産"],
  ["1130", "未収入金", "流動資産"],
  ["1140", "前払費用", "流動資産"],
  ["1150", "前払金", "流動資産"],
  ["1155", "仮払消費税等", "流動資産"],
  ["1160", "仮払金", "流動資産"],
  ["1170", "立替金", "流動資産"],
  ["1180", "貯蔵品", "流動資産"],
  ["1190", "商品", "流動資産"],
  ["1200", "仕掛品", "流動資産"],
  ["1210", "原材料", "流動資産"],
  ["1310", "建物", "固定資産"],
  ["1320", "建物附属設備", "固定資産"],
  ["1330", "車両運搬具", "固定資産"],
  ["1340", "工具器具備品", "固定資産"],
  ["1350", "土地", "固定資産"],
  ["1360", "ソフトウェア", "固定資産"],
  ["1370", "敷金", "固定資産"],
  ["1380", "保証金", "固定資産"],
  ["1390", "長期前払費用", "固定資産"],
  ["1410", "出資金", "固定資産"],
  ["1510", "開業費", "繰延資産"],
  ["1520", "創立費", "繰延資産"],
];

const LIABILITY_ACCOUNTS: [string, string, string][] = [
  ["2010", "買掛金", "流動負債"],
  ["2020", "支払手形", "流動負債"],
  ["2030", "未払金", "流動負債"],
  ["2040", "未払費用", "流動負債"],
  ["2050", "未払消費税等", "流動負債"],
  ["2055", "仮受消費税等", "流動負債"],
  ["2060", "未払法人税等", "流動負債"],
  ["2070", "預り金", "流動負債"],
  ["2080", "前受金", "流動負債"],
  ["2090", "仮受金", "流動負債"],
  ["2100", "短期借入金", "流動負債"],
  ["2110", "賞与引当金", "流動負債"],
  ["2210", "長期借入金", "固定負債"],
  ["2220", "退職給付引当金", "固定負債"],
];

const REVENUE_ACCOUNTS: [string, string, string][] = [
  ["4010", "売上高", "売上高"],
  ["4110", "受取利息", "営業外収益"],
  ["4120", "受取配当金", "営業外収益"],
  ["4130", "為替差益", "営業外収益"],
  ["4140", "雑収入", "営業外収益"],
  ["4210", "固定資産売却益", "特別利益"],
];

const EXPENSE_ACCOUNTS: [string, string, string][] = [
  ["5010", "仕入高", "売上原価"],
  ["5020", "外注費", "売上原価"],
  ["6010", "役員報酬", "販売費及び一般管理費"],
  ["6011", "専従者給与", "販売費及び一般管理費"],
  ["6020", "給料賃金", "販売費及び一般管理費"],
  ["6030", "雑給", "販売費及び一般管理費"],
  ["6040", "法定福利費", "販売費及び一般管理費"],
  ["6050", "福利厚生費", "販売費及び一般管理費"],
  ["6060", "外注工賃", "販売費及び一般管理費"],
  ["6070", "荷造運賃", "販売費及び一般管理費"],
  ["6080", "広告宣伝費", "販売費及び一般管理費"],
  ["6090", "交際費", "販売費及び一般管理費"],
  ["6100", "会議費", "販売費及び一般管理費"],
  ["6110", "旅費交通費", "販売費及び一般管理費"],
  ["6120", "通信費", "販売費及び一般管理費"],
  ["6130", "水道光熱費", "販売費及び一般管理費"],
  ["6140", "新聞図書費", "販売費及び一般管理費"],
  ["6150", "消耗品費", "販売費及び一般管理費"],
  ["6160", "事務用品費", "販売費及び一般管理費"],
  ["6170", "修繕費", "販売費及び一般管理費"],
  ["6180", "地代家賃", "販売費及び一般管理費"],
  ["6190", "保険料", "販売費及び一般管理費"],
  ["6200", "租税公課", "販売費及び一般管理費"],
  ["6210", "減価償却費", "販売費及び一般管理費"],
  ["6220", "支払手数料", "販売費及び一般管理費"],
  ["6230", "支払報酬料", "販売費及び一般管理費"],
  ["6240", "諸会費", "販売費及び一般管理費"],
  ["6250", "リース料", "販売費及び一般管理費"],
  ["6260", "車両費", "販売費及び一般管理費"],
  ["6270", "研修費", "販売費及び一般管理費"],
  ["6280", "雑費", "販売費及び一般管理費"],
  ["7010", "支払利息", "営業外費用"],
  ["7020", "雑損失", "営業外費用"],
  ["7030", "為替差損", "営業外費用"],
  ["7110", "固定資産売却損", "特別損失"],
  ["7210", "法人税、住民税及び事業税", "法人税等"],
];

const EQUITY_ACCOUNTS_INDIVIDUAL: [string, string, string][] = [
  ["3010", "元入金", "資本"],
  ["3020", "事業主借", "資本"],
  ["3030", "事業主貸", "資本"],
];

const EQUITY_ACCOUNTS_CORPORATE: [string, string, string][] = [
  ["3010", "資本金", "株主資本"],
  ["3020", "資本準備金", "株主資本"],
  ["3030", "利益準備金", "株主資本"],
  ["3040", "繰越利益剰余金", "株主資本"],
];

function toDefs(
  rows: [string, string, string][],
  category: AccountCategory,
  taxCategoryCode?: string
): DefaultAccountDef[] {
  return rows.map(([code, name, subcategory]) => ({
    code,
    name,
    category,
    subcategory,
    normalBalance: normalBalanceForCategory(category),
    defaultTaxCategoryCode: taxCategoryCode,
  }));
}

export function getDefaultAccounts(businessType: BusinessType): DefaultAccountDef[] {
  const equity =
    businessType === "CORPORATE" ? EQUITY_ACCOUNTS_CORPORATE : EQUITY_ACCOUNTS_INDIVIDUAL;

  return [
    ...toDefs(ASSET_ACCOUNTS, "ASSET"),
    ...toDefs(LIABILITY_ACCOUNTS, "LIABILITY"),
    ...toDefs(equity, "EQUITY"),
    ...toDefs(REVENUE_ACCOUNTS, "REVENUE", "TAX10"),
    ...toDefs(EXPENSE_ACCOUNTS, "EXPENSE", "PUR10"),
  ];
}

export const DEFAULT_TAX_CATEGORIES = [
  { code: "TAX10", name: "課税売上10%", rate: 0.1, kind: "TAXABLE_SALES", isReducedRate: false },
  { code: "TAX8R", name: "課税売上8%(軽減)", rate: 0.08, kind: "TAXABLE_SALES", isReducedRate: true },
  { code: "PUR10", name: "課税仕入10%", rate: 0.1, kind: "TAXABLE_PURCHASE", isReducedRate: false },
  { code: "PUR8R", name: "課税仕入8%(軽減)", rate: 0.08, kind: "TAXABLE_PURCHASE", isReducedRate: true },
  { code: "EXEMPT", name: "非課税", rate: 0, kind: "EXEMPT", isReducedRate: false },
  { code: "OUT", name: "不課税", rate: 0, kind: "OUT_OF_SCOPE", isReducedRate: false },
  { code: "EXPORT0", name: "輸出免税", rate: 0, kind: "EXPORT", isReducedRate: false },
] as const;
