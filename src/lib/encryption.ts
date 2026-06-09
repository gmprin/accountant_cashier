// Κρυπτογράφηση/αποκρυπτογράφηση ευαίσθητων δεδομένων
// Χρησιμοποιεί AES-256-GCM μέσω Web Crypto API (server-side)

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''

async function getKey(): Promise<CryptoKey> {
  const keyData = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32))
  return crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(data: object): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + encrypted.byteLength)
  combined.set(iv, 0)
  combined.set(new Uint8Array(encrypted), iv.length)
  return Buffer.from(combined).toString('base64')
}

export async function decryptData(encryptedBase64: string): Promise<object> {
  const key = await getKey()
  const combined = Buffer.from(encryptedBase64, 'base64')
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(decrypted))
}
