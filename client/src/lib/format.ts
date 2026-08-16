export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" }).format(amount);
}

export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  // 日付はすべてUTC基準(年月日のみ)で保存・計算しているため、表示側もUTCに固定して
  // 閲覧者のタイムゾーンによって日付が前後にずれるのを防ぐ。
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(d);
}

export function toInputDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}
