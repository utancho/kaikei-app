export interface WorkflowOverview {
  counts: Record<string, number>;
  lock: { closedThrough: string | null; reason?: string } | null;
  evidenceQuota: { usedBytes?: number; maxBytes?: number; maxFileBytes?: number };
  freeLimits: Record<string, number | boolean>;
}
export interface WorkflowRecord { id: string; [key: string]: unknown }
export async function workflowRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: "include" });
  if (!response.ok) {
    let message = `処理できませんでした (${response.status})`;
    try { const data = await response.json(); message = data.error?.message || data.error || data.message || message; } catch { /* non JSON errors */ }
    throw new Error(typeof message === "string" ? message : `処理できませんでした (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const workflowPath = (businessId: string, action: string, extra = "") => `/workflows/${action}?businessId=${encodeURIComponent(businessId)}${extra}`;
export async function downloadWorkflow(path: string, filename: string) {
  const response = await fetch(`/api${path}`, { credentials: "include" });
  if (!response.ok) throw new Error(`ダウンロードできませんでした (${response.status})`);
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
