import type { Request } from "express";
import { badRequest } from "./httpError.js";

export function requireBusinessId(req: Request): string {
  const businessId = (req.query.businessId as string) || (req.body?.businessId as string);
  if (!businessId) badRequest("businessId is required");
  return businessId;
}

export function parseDateParam(value: unknown): Date | undefined {
  if (!value || typeof value !== "string") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}
