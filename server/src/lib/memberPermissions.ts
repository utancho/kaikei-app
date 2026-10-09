export function canWriteBusiness(role: string, method: string): boolean {
  return ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase()) || role === "OWNER" || role === "MEMBER";
}
