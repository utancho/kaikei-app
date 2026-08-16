import { z } from "zod";
import {
  ACCOUNT_CATEGORIES,
  BUSINESS_TYPES,
  ENTRY_SIDES,
  INVOICE_STATUSES,
  PARTNER_TYPES,
  TAXATION_TYPES,
} from "./enums.js";

export const signupInputSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
  name: z.string().optional(),
});

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const businessInputSchema = z.object({
  name: z.string().min(1, "屋号/会社名を入力してください"),
  type: z.enum(BUSINESS_TYPES),
  representativeName: z.string().optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  taxationType: z.enum(TAXATION_TYPES).optional(),
  blueReturnDeduction: z.union([z.literal(0), z.literal(100000), z.literal(550000), z.literal(650000)]).optional(),
});

export const accountInputSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(ACCOUNT_CATEGORIES),
  subcategory: z.string().min(1),
  defaultTaxCategoryId: z.string().optional().nullable(),
});

export const partnerInputSchema = z.object({
  name: z.string().min(1),
  kana: z.string().optional(),
  type: z.enum(PARTNER_TYPES).optional(),
  postalCode: z.string().optional(),
  address: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
});

export const journalLineInputSchema = z.object({
  side: z.enum(ENTRY_SIDES),
  accountId: z.string().min(1),
  subAccountId: z.string().optional().nullable(),
  partnerId: z.string().optional().nullable(),
  taxCategoryId: z.string().optional().nullable(),
  amount: z.number().int().positive("金額は1円以上で入力してください"),
  taxAmount: z.number().int().min(0).optional(),
  description: z.string().optional(),
});

export const journalEntryInputSchema = z.object({
  entryDate: z.coerce.date(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "CONFIRMED"]).optional(),
  lines: z.array(journalLineInputSchema).min(2, "仕訳は借方・貸方それぞれ1行以上必要です"),
});

export const invoiceItemInputSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().int(),
  taxCategoryId: z.string().optional().nullable(),
});

export const fixedAssetInputSchema = z.object({
  name: z.string().min(1),
  assetAccountId: z.string().min(1),
  expenseAccountId: z.string().min(1),
  acquisitionDate: z.coerce.date(),
  acquisitionCost: z.number().int().positive(),
  residualValue: z.number().int().min(0).optional(),
  usefulLifeYears: z.number().int().positive(),
  depreciationMethod: z.enum(["STRAIGHT_LINE", "DECLINING_BALANCE"]),
  memo: z.string().optional(),
});

export const templateLineInputSchema = z.object({
  side: z.enum(ENTRY_SIDES),
  accountId: z.string().min(1),
  partnerId: z.string().optional().nullable(),
  taxCategoryId: z.string().optional().nullable(),
  amountDefault: z.number().int().positive().optional().nullable(),
  description: z.string().optional(),
});

export const templateInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  lines: z.array(templateLineInputSchema).min(2, "テンプレートは借方・貸方それぞれ1行以上必要です"),
});

export const invoiceInputSchema = z.object({
  partnerId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  notes: z.string().optional(),
  items: z.array(invoiceItemInputSchema).min(1, "明細を1件以上入力してください"),
});
