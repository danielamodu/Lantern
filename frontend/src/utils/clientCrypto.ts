/**
 * Client-side ECIES decryption using Web Crypto API.
 * No private keys ever leave the browser.
 */

export interface EncryptedPayload {
  ephemeralPublicKeyHex: string;
  ivHex: string;
  tagHex: string;
  ciphertextHex: string;
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(sharedSecret: ArrayBuffer): Promise<CryptoKey> {
  const hash = await crypto.subtle.digest('SHA-256', sharedSecret);
  return crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
}

/**
 * Decrypts ECIES-encrypted settlement data client-side.
 * @param payload The encrypted payload
 * @param privateViewKeyHex The auditor's private view key (secp256r1 / P-256)
 * @returns The decrypted amount string
 * @throws Error if decryption fails (wrong key or corrupted payload)
 */
export async function decryptSettlementClient(
  payload: EncryptedPayload,
  privateViewKeyHex: string
): Promise<string> {
  try {
    const ecdh = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    const privateViewKeyBytes = hexToArrayBuffer(privateViewKeyHex);
    const ephemeralKeyBytes = hexToArrayBuffer(payload.ephemeralPublicKeyHex);

    const importedPrivate = await crypto.subtle.importKey(
      'raw',
      privateViewKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveBits', 'deriveKey']
    );

    const importedEphemeral = await crypto.subtle.importKey(
      'spki',
      ephemeralKeyBytes,
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      []
    );

    const sharedSecret = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: importedEphemeral },
      importedPrivate,
      256
    );

    const aesKey = await deriveKey(sharedSecret);

    const iv = hexToArrayBuffer(payload.ivHex);
    const tag = hexToArrayBuffer(payload.tagHex);
    const ciphertext = hexToArrayBuffer(payload.ciphertextHex);

    const combined = new Uint8Array(iv.byteLength + tag.byteLength + ciphertext.byteLength);
    combined.set(new Uint8Array(iv), 0);
    combined.set(new Uint8Array(tag), iv.byteLength);
    combined.set(new Uint8Array(ciphertext), iv.byteLength + tag.byteLength);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      aesKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err: any) {
    throw new Error(`Decryption failed: ${err.message || 'Invalid key or corrupted payload'}`);
  }
}

/**
 * Encrypts settlement amount client-side (for consistency with server-side).
 * Uses Web Crypto API's ECDH + AES-GCM.
 */
export async function encryptSettlementClient(
  amount: string,
  auditorPublicKeyHex: string
): Promise<EncryptedPayload> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits', 'deriveKey']
  );

  const privateKey = await crypto.subtle.exportKey('raw', keyPair.privateKey);
  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  const auditorKeyBytes = hexToArrayBuffer(auditorPublicKeyHex);

  const importedAuditor = await crypto.subtle.importKey(
    'spki',
    auditorKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: importedAuditor },
    keyPair.privateKey,
    256
  );

  const aesKey = await deriveKey(sharedSecret);

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(amount);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoded
  );

  const tagStart = ciphertext.byteLength - 16;
  const tag = ciphertext.slice(tagStart);

  return {
    ephemeralPublicKeyHex: '04' + arrayBufferToHex(publicKey),
    ivHex: arrayBufferToHex(iv),
    tagHex: arrayBufferToHex(tag),
    ciphertextHex: arrayBufferToHex(ciphertext.slice(0, tagStart))
  };
}