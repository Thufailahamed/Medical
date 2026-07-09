/**
 * PayHere payment gateway helpers.
 *
 * Specs (PayHere docs):
 *   - Sandbox URL: https://sandbox.payhere.lk/pay/checkout
 *   - Live URL:    https://www.payhere.lk/pay/checkout
 *   - Hash gen:    MD5(merchant_id + order_id + amount(2dp) + currency + MD5(secret).toUpperCase()).toUpperCase()
 *   - Notify ver:  MD5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + MD5(secret).toUpperCase()).toUpperCase()
 *
 * Status codes from notify callback:
 *   2  = success
 *   0  = pending
 *   -1 = cancelled
 *   -2 = failed
 *   -3 = chargeback
 *
 * Amounts MUST be passed as 2-decimal-place strings ("1500.00"), not raw
 * numbers — otherwise MD5 mismatches.
 */

export interface PayHereEnv {
  PAYHERE_MERCHANT_ID?: string;
  PAYHERE_SECRET?: string;
  PAYHERE_SANDBOX?: string;
  PUBLIC_URL?: string;
}

export type PayHereStatus = "paid" | "pending" | "failed" | "cancelled" | "chargeback";

/** Maps PayHere status_code int → normalized string. */
export function mapStatusCode(code: string | number): PayHereStatus {
  const n = typeof code === "string" ? parseInt(code, 10) : code;
  switch (n) {
    case 2:
      return "paid";
    case 0:
      return "pending";
    case -1:
      return "cancelled";
    case -2:
      return "failed";
    case -3:
      return "chargeback";
    default:
      return "failed";
  }
}

/** Whether the configured provider is sandbox. */
export function isSandbox(env: PayHereEnv): boolean {
  return env.PAYHERE_SANDBOX === "true" || env.PAYHERE_SANDBOX === "1";
}

/** Checkout URL (sandbox or live) for hosted PayHere page. */
export function checkoutUrl(env: PayHereEnv): string {
  return isSandbox(env)
    ? "https://sandbox.payhere.lk/pay/checkout"
    : "https://www.payhere.lk/pay/checkout";
}

/** Format an LKR amount as 2-decimal string for hashing. */
export function formatAmount(amount: number): string {
  return amount.toFixed(2);
}

/** Mint a unique order ID. Format: HH-{uuid36} — short, collision-resistant, sortable by prefix. */
export function mintOrderId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `HH${uuid.slice(0, 20)}`;
}

/**
 * Compute PayHere checkout hash. Requires the merchant secret.
 * Algorithm: MD5(merchant_id + order_id + amount(2dp) + currency + MD5(secret).toUpperCase()).toUpperCase()
 *
 * Web Crypto API does not expose MD5, so we use SubtleCrypto's HMAC-SHA256
 * fallback is NOT acceptable here. MD5 is required by PayHere. We use a
 * tiny pure-JS MD5 inline (public-domain implementation, RFC 1321).
 */
export async function computeHash(
  merchantId: string,
  orderId: string,
  amount: number,
  currency: string,
  secret: string
): Promise<string> {
  const secretUpper = await md5Hex(secret);
  const payload = `${merchantId}${orderId}${formatAmount(amount)}${currency}${secretUpper.toUpperCase()}`;
  const hash = await md5Hex(payload);
  return hash.toUpperCase();
}

/**
 * Verify a PayHere server-to-server notify callback.
 * Returns true if `md5sig` matches the recomputed hash for the given fields.
 */
export async function verifyNotify(
  fields: {
    merchant_id: string;
    order_id: string;
    payhere_amount: string;
    payhere_currency: string;
    status_code: string;
    md5sig: string;
  },
  secret: string
): Promise<boolean> {
  const secretUpper = await md5Hex(secret);
  const payload =
    `${fields.merchant_id}` +
    `${fields.order_id}` +
    `${fields.payhere_amount}` +
    `${fields.payhere_currency}` +
    `${fields.status_code}` +
    `${secretUpper.toUpperCase()}`;
  const expected = (await md5Hex(payload)).toUpperCase();
  const given = fields.md5sig.toUpperCase();
  return expected === given;
}

/**
 * Pure-JS MD5 (RFC 1321). Tiny, public-domain.
 * Returns lowercase hex.
 *
 * Source adapted from Joseph Myers' public-domain MD5 implementation.
 */
export async function md5Hex(input: string): Promise<string> {
  // Encode UTF-8 bytes.
  const bytes = new TextEncoder().encode(input);
  // Run sync MD5 (it's fast even on long inputs; cf Workers handles it fine).
  return md5Sync(bytes);
}

function md5Sync(bytes: Uint8Array): string {
  function rh(n: number) {
    let s = "";
    for (let j = 0; j <= 3; j++) {
      s += ((n >> (j * 8 + 4)) & 0x0f).toString(16) + ((n >> (j * 8)) & 0x0f).toString(16);
    }
    return s;
  }
  function ad(x: number, y: number) {
    const lsw = (x & 0xffff) + (y & 0xffff);
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xffff);
  }
  function rol(n: number, c: number) {
    return (n << c) | (n >>> (32 - c));
  }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return ad(rol(ad(ad(a, q), ad(x, t)), s), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & c) | (~b & d), a, b, x, s, t);
  }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t);
  }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) {
    return cmn(c ^ (b | ~d), a, b, x, s, t);
  }

  const n = bytes.length;
  // Pad to 64-byte boundary. Append 0x80, then zeros, then 8-byte length.
  const padLen = (((n + 8) >> 6) + 1) << 6;
  const buf = new Uint8Array(padLen);
  buf.set(bytes);
  buf[n] = 0x80;
  // Length in bits as little-endian 64-bit.
  const bitLen = BigInt(n) * 8n;
  const lenHi = Number((bitLen >> 32n) & 0xffffffffn);
  const lenLo = Number(bitLen & 0xffffffffn);
  const dv = new DataView(buf.buffer);
  dv.setUint32(padLen - 8, lenLo, true);
  dv.setUint32(padLen - 4, lenHi, true);

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  for (let i = 0; i < padLen; i += 64) {
    const x = new Uint32Array(buf.buffer, i, 16);
    const oa = a, ob = b, oc = c, od = d;
    // Round 1
    a = ff(a, b, c, d, x[0], 7, -680876936);
    d = ff(d, a, b, c, x[1], 12, -389564586);
    c = ff(c, d, a, b, x[2], 17, 606105819);
    b = ff(b, c, d, a, x[3], 22, -1044525330);
    a = ff(a, b, c, d, x[4], 7, -176418897);
    d = ff(d, a, b, c, x[5], 12, 1200080426);
    c = ff(c, d, a, b, x[6], 17, -1473231341);
    b = ff(b, c, d, a, x[7], 22, -45705983);
    a = ff(a, b, c, d, x[8], 7, 1770035416);
    d = ff(d, a, b, c, x[9], 12, -1958414417);
    c = ff(c, d, a, b, x[10], 17, -42063);
    b = ff(b, c, d, a, x[11], 22, -1990404162);
    a = ff(a, b, c, d, x[12], 7, 1804603682);
    d = ff(d, a, b, c, x[13], 12, -40341101);
    c = ff(c, d, a, b, x[14], 17, -1502002290);
    b = ff(b, c, d, a, x[15], 22, 1236535329);
    // Round 2
    a = gg(a, b, c, d, x[1], 5, -165796510);
    d = gg(d, a, b, c, x[6], 9, -1069501632);
    c = gg(c, d, a, b, x[11], 14, 643717713);
    b = gg(b, c, d, a, x[0], 20, -373897302);
    a = gg(a, b, c, d, x[5], 5, -701558691);
    d = gg(d, a, b, c, x[10], 9, 38016083);
    c = gg(c, d, a, b, x[15], 14, -660478335);
    b = gg(b, c, d, a, x[4], 20, -405537848);
    a = gg(a, b, c, d, x[9], 5, 568446438);
    d = gg(d, a, b, c, x[14], 9, -1019803690);
    c = gg(c, d, a, b, x[3], 14, -187363961);
    b = gg(b, c, d, a, x[8], 20, 1163531501);
    a = gg(a, b, c, d, x[13], 5, -1444681467);
    d = gg(d, a, b, c, x[2], 9, -51403784);
    c = gg(c, d, a, b, x[7], 14, 1735328473);
    b = gg(b, c, d, a, x[12], 20, -1926607734);
    // Round 3
    a = hh(a, b, c, d, x[5], 4, -378558);
    d = hh(d, a, b, c, x[8], 11, -2022574463);
    c = hh(c, d, a, b, x[11], 16, 1839030562);
    b = hh(b, c, d, a, x[14], 23, -35309556);
    a = hh(a, b, c, d, x[1], 4, -1530992060);
    d = hh(d, a, b, c, x[4], 11, 1272893353);
    c = hh(c, d, a, b, x[7], 16, -155497632);
    b = hh(b, c, d, a, x[10], 23, -1094730640);
    a = hh(a, b, c, d, x[13], 4, 681279174);
    d = hh(d, a, b, c, x[0], 11, -358537222);
    c = hh(c, d, a, b, x[3], 16, -722521979);
    b = hh(b, c, d, a, x[6], 23, 76029189);
    a = hh(a, b, c, d, x[9], 4, -640364487);
    d = hh(d, a, b, c, x[12], 11, -421815835);
    c = hh(c, d, a, b, x[15], 16, 530742520);
    b = hh(b, c, d, a, x[2], 23, -995338651);
    // Round 4
    a = ii(a, b, c, d, x[0], 6, -198630844);
    d = ii(d, a, b, c, x[7], 10, 1126891415);
    c = ii(c, d, a, b, x[14], 15, -1416354905);
    b = ii(b, c, d, a, x[5], 21, -57434055);
    a = ii(a, b, c, d, x[12], 6, 1700485571);
    d = ii(d, a, b, c, x[3], 10, -1894986606);
    c = ii(c, d, a, b, x[10], 15, -1051523);
    b = ii(b, c, d, a, x[1], 21, -2054922799);
    a = ii(a, b, c, d, x[8], 6, 1873313359);
    d = ii(d, a, b, c, x[15], 10, -30611744);
    c = ii(c, d, a, b, x[6], 15, -1560198380);
    b = ii(b, c, d, a, x[13], 21, 1309151649);
    a = ii(a, b, c, d, x[4], 6, -145523070);
    d = ii(d, a, b, c, x[11], 10, -1120210379);
    c = ii(c, d, a, b, x[2], 15, 718787259);
    b = ii(b, c, d, a, x[9], 21, -343485551);

    a = ad(a, oa);
    b = ad(b, ob);
    c = ad(c, oc);
    d = ad(d, od);
  }
  return rh(a) + rh(b) + rh(c) + rh(d);
}