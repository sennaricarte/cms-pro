/**
 * Hash de senha com Web Crypto (PBKDF2).
 * Usado no admin (browser) e no middleware.ts (Edge da Vercel).
 * Sem Node APIs, sem libs externas.
 */

export const ITERATIONS = 100_000;
const SALT_BYTES = 16;
const DERIVED_BITS = 256;

export interface CmsUser {
  username: string;
  salt: string;
  hash: string;
  createdAt: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i) & 0xff;
  }

  return bytes;
}

export function generateSalt(): string {
  const bytes = new Uint8Array(SALT_BYTES);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

export async function hashPassword(password: string, saltBase64: string): Promise<string> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64) as BufferSource,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    DERIVED_BITS,
  );

  return bytesToBase64(new Uint8Array(bits));
}

export async function timingSafeEqual(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(left)),
    crypto.subtle.digest('SHA-256', encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftDigest);
  const rightBytes = new Uint8Array(rightDigest);
  let mismatch = 0;

  for (let i = 0; i < leftBytes.length; i += 1) {
    mismatch |= leftBytes[i] ^ rightBytes[i];
  }

  return mismatch === 0;
}

export async function verifyPassword(
  password: string,
  saltBase64: string,
  expectedHashBase64: string,
): Promise<boolean> {
  const computed = await hashPassword(password, saltBase64);
  return timingSafeEqual(computed, expectedHashBase64);
}

export function isCmsUser(value: unknown): value is CmsUser {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.username === 'string' &&
    typeof user.salt === 'string' &&
    typeof user.hash === 'string' &&
    typeof user.createdAt === 'string'
  );
}

export function parseCmsUsers(value: unknown): CmsUser[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isCmsUser);
}
