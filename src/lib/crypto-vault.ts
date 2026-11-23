import crypto from "crypto";

const DEFAULT_DEV_KEY = "twofold-studio-os-dev-encryption-key-32bytes!";

function getEncryptionKey(): Buffer {
  const raw =
    process.env.ENCRYPTION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    DEFAULT_DEV_KEY;
  return crypto.createHash("sha256").update(raw).digest();
}

/**
 * Encrypts sensitive integration tokens/credentials using AES-256-GCM.
 * Never expose the decrypted output to client components.
 */
export function encryptSecrets(payload: Record<string, unknown>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptSecrets<T = Record<string, unknown>>(
  ciphertext: string
): T | null {
  try {
    const parts = ciphertext.split(".");
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, "base64url");
    const authTag = Buffer.from(tagB64, "base64url");
    const encrypted = Buffer.from(dataB64, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

/**
 * Generates a signed, expiring OAuth state token to prevent CSRF attacks.
 */
export function createOAuthState(data: {
  provider: string;
  workspaceId: string;
  memberId: string;
  redirectTo?: string;
}): string {
  const payload = {
    ...data,
    nonce: crypto.randomBytes(8).toString("hex"),
    exp: Date.now() + 15 * 60 * 1000, // 15 minutes
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", getEncryptionKey())
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyOAuthState(stateToken: string): {
  valid: boolean;
  error?: string;
  payload?: {
    provider: string;
    workspaceId: string;
    memberId: string;
    redirectTo?: string;
    exp: number;
  };
} {
  try {
    const [encoded, sig] = stateToken.split(".");
    if (!encoded || !sig) {
      return { valid: false, error: "Malformed OAuth state parameter" };
    }
    const expectedSig = crypto
      .createHmac("sha256", getEncryptionKey())
      .update(encoded)
      .digest("base64url");
    if (
      sig.length !== expectedSig.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))
    ) {
      return { valid: false, error: "Invalid OAuth state signature" };
    }
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (Date.now() > payload.exp) {
      return { valid: false, error: "OAuth state token expired" };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Failed to parse OAuth state token" };
  }
}

/**
 * Verifies Meta (WhatsApp Business & Instagram) X-Hub-Signature-256 HMAC header.
 */
export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  if (signatureHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

/**
 * Verifies Twilio X-Twilio-Signature header (HMAC-SHA1 over URL + sorted POST params).
 */
export function verifyTwilioWebhookSignature(
  fullUrl: string,
  params: Record<string, string>,
  signatureHeader: string | null,
  authToken: string
): boolean {
  if (!signatureHeader || !authToken) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = fullUrl;
  for (const k of sortedKeys) {
    data += k + (params[k] ?? "");
  }
  const expected = crypto
    .createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");
  if (signatureHeader.length !== expected.length) return false;
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

/**
 * Generates a deterministic UUID v5-like identifier from a legacy string ID
 * so migration from legacy IDs (e.g. "lead-1", "tm-1") is 100% repeatable.
 */
export function deterministicUuid(namespace: string, legacyId: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${namespace}:${legacyId}`)
    .digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "a" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}
