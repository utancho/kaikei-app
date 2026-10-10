import { Buffer } from 'node:buffer';

const PREFIX = 'enc:v1:';

async function encryptionKey(material?: string) {
  if (!material) throw new Error('TOTP encryption key is not configured');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`keirio:totp:v1:${material}`));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function sealTotpSecret(secret: string, userId: string, material?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    await encryptionKey(material), new TextEncoder().encode(secret),
  );
  return `${PREFIX}${Buffer.from(iv).toString('base64url')}:${Buffer.from(ciphertext).toString('base64url')}`;
}

export async function openTotpSecret(stored: string, userId: string, material?: string): Promise<string> {
  // Legacy seeds remain usable and are migrated only after successful authentication.
  if (!stored.startsWith('enc:')) {
    if (!/^[A-Z2-7]+$/.test(stored)) throw new Error('Invalid legacy TOTP seed');
    return stored;
  }
  if (!stored.startsWith(PREFIX)) throw new Error('Unsupported TOTP encryption version');
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 2 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error('Invalid encrypted TOTP seed');
  const iv = Uint8Array.from(Buffer.from(parts[0], 'base64url'));
  if (iv.length !== 12) throw new Error('Invalid TOTP encryption nonce');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(userId) },
    await encryptionKey(material), Uint8Array.from(Buffer.from(parts[1], 'base64url')),
  );
  return new TextDecoder().decode(plaintext);
}
