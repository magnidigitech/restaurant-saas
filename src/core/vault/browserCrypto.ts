// Browser Web Crypto helpers for Zero-Knowledge AES-256-GCM Vault

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const PBKDF2_ITERATIONS = 600000;

export async function browserGenerateSalt(length = 16): Promise<string> {
  const salt = new Uint8Array(length);
  window.crypto.getRandomValues(salt);
  return bytesToHex(salt);
}

export async function browserDeriveMasterKey(
  masterPassword: string,
  saltHex: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const saltBytes = hexToBytes(saltHex);

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: saltBytes as any,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function browserComputeKeyVerifier(masterKey: CryptoKey): Promise<string> {
  // Encrypt a known verification string to test decryption
  const enc = new TextEncoder();
  const iv = new Uint8Array(12); // deterministic test vector or HMAC
  const rawKeyData = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    masterKey,
    enc.encode("VAULT_KEY_VERIFIER_STRING")
  );
  return bufferToBase64(rawKeyData);
}

export async function browserEncryptPayload(
  payload: any,
  masterKey: CryptoKey
): Promise<{ encryptedData: string; iv: string; authTag: string }> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(payload));
  const iv = new Uint8Array(12);
  window.crypto.getRandomValues(iv);

  const ciphertextWithTag = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      tagLength: 128,
    },
    masterKey,
    plaintext
  );

  const totalBytes = new Uint8Array(ciphertextWithTag);
  // In WebCrypto, AES-GCM appends the 16-byte authTag at the end
  const ciphertextBytes = totalBytes.slice(0, totalBytes.length - 16);
  const authTagBytes = totalBytes.slice(totalBytes.length - 16);

  return {
    encryptedData: bufferToBase64(ciphertextBytes),
    iv: bufferToBase64(iv),
    authTag: bufferToBase64(authTagBytes),
  };
}

export async function browserDecryptPayload(
  encryptedData: string,
  ivBase64: string,
  authTagBase64: string,
  masterKey: CryptoKey
): Promise<any> {
  const ciphertextBytes = base64ToBuffer(encryptedData);
  const ivBytes = base64ToBuffer(ivBase64);
  const authTagBytes = base64ToBuffer(authTagBase64);

  // Combine ciphertext + authTag for WebCrypto
  const combined = new Uint8Array(ciphertextBytes.length + authTagBytes.length);
  combined.set(ciphertextBytes, 0);
  combined.set(authTagBytes, ciphertextBytes.length);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes as any,
      tagLength: 128,
    },
    masterKey,
    combined
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
}
