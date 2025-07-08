import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

// Ensure encryption key and IV are set
if (!process.env.ENCRYPTION_KEY || !process.env.ENCRYPTION_IV) {
  throw new Error('ENCRYPTION_KEY and ENCRYPTION_IV must be set in environment variables.');
}

// Validate key and IV lengths
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const iv = Buffer.from(process.env.ENCRYPTION_IV, 'hex');

if (key.length !== 32) {
  throw new Error('ENCRYPTION_KEY must be a 32-byte hex string.');
}

if (iv.length !== 16) {
  throw new Error('ENCRYPTION_IV must be a 16-byte hex string.');
}

/**
 * Encrypts a string using AES-256-GCM.
 * @param text The string to encrypt.
 * @returns The encrypted string in 'hex' format, including the auth tag.
 */
export function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Prepend the auth tag to the encrypted data for use in decryption
  return Buffer.concat([authTag, encrypted]).toString('hex');
}

/**
 * Decrypts a string encrypted with AES-256-GCM.
 * @param encryptedText The hex-encoded string to decrypt (must include the auth tag).
 * @returns The original decrypted string.
 */
export function decrypt(encryptedText: string): string {
  const data = Buffer.from(encryptedText, 'hex');
  // Extract the auth tag (it's the first 16 bytes)
  const authTag = data.slice(0, 16);
  const encrypted = data.slice(16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
} 