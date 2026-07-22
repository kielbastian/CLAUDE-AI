// Narzędzia kryptograficzne sejfu: PBKDF2 (wyprowadzenie klucza z hasła
// głównego) + AES-256-GCM (szyfrowanie zawartości sejfu).

export const PBKDF2_ITERATIONS = 310000;

export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function toB64(bytes) {
  let binary = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary);
}

export function fromB64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function deriveKey(masterPassword, saltBytes, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true, // eksportowalny, aby móc trzymać klucz w storage.session na czas sesji
    ["encrypt", "decrypt"]
  );
}

export async function exportKeyB64(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return toB64(raw);
}

export async function importKeyB64(b64) {
  return crypto.subtle.importKey("raw", fromB64(b64), { name: "AES-GCM" }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { iv: toB64(iv), data: toB64(ciphertext) };
}

// Rzuca wyjątkiem przy złym kluczu (AES-GCM weryfikuje integralność),
// co służy jednocześnie jako weryfikacja hasła głównego.
export async function decryptJSON(key, payload) {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(payload.iv) },
    key,
    fromB64(payload.data)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
