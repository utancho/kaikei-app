export async function hashInviteToken(token: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map(value=>value.toString(16).padStart(2,"0")).join("");
}
export function createInviteToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(value=>value.toString(16).padStart(2,"0")).join("");
}
