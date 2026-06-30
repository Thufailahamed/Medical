// @ts-nocheck
// Phase 1.4: Cloudflare Email Routing worker entry. Wired via the
// `email` property on the Worker's `ExportedHandler` (see src/index.ts).
// Inbound flow:
//   1. CF Email Routing routes the message here.
//   2. We resolve the recipient (To alias → user) and (From address → user).
//      Drop silently if neither matches a known user — anti-enumeration.
//   3. Parse with postal-mime. For each attachment, write to R2 + insert
//      a medical_records row via process.ts.
//   4. Reply with a short ack.
//
// Phase 2.1 will move steps 3-4 to a CF Queue when OCR pipeline joins.

import PostalMime from "postal-mime";
import { findUserByAlias, findUserByEmail } from "../lib/alias";
import { processInboundEmail, type Source } from "./process";
import { buildAckReply } from "./reply";

interface Env {
  DB: any;
  R2: R2Bucket;
  AI: any;
  EMAIL_ALIAS_DOMAIN: string;
  DEV_MODE?: string;
  CLASSIFY_THRESHOLD?: string;
}

interface CFEmailMessage {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array>;
  rawSize: number;
  setReject(reason: string): void;
  reply(message: { from: string; to: string; raw: ReadableStream<Uint8Array> }): Promise<unknown>;
  forward(rcptTo: string, headers?: Headers): Promise<unknown>;
}

/**
 * Extract the local-part (alias) from a `to` address like
 * "u_a1b2c3d4@records.healthhub.app". Returns null for malformed
 * addresses.
 */
function aliasFromAddress(addr: string): string | null {
  const at = addr.lastIndexOf("<");
  // RFC 5322 form: "Name <u_xxx@records.domain>". Unwrap angle brackets.
  const inner = at >= 0 ? addr.slice(at + 1, addr.indexOf(">", at + 1)) : addr;
  const local = inner.split("@")[0]?.trim();
  if (!local || !local.startsWith("u_")) return null;
  return local;
}

/**
 * Reverse of `aliasFromAddress` — extract the clean email from a From
 * header that may carry display name.
 */
function emailFromAddress(addr: string): string | null {
  const at = addr.lastIndexOf("<");
  const inner = at >= 0 ? addr.slice(at + 1, addr.indexOf(">", at + 1)) : addr;
  const cleaned = inner.trim().toLowerCase();
  return /.+@.+/.test(cleaned) ? cleaned : null;
}

/**
 * Build a raw RFC822 stream suitable for `message.reply()`. CF's
 * EmailMessage expects the form `{ from, to, raw }` where `raw` is the
 * serialised message including headers + body.
 */
function buildReplyStream(subject: string, body: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const message =
    `From: Healthcare Records <noreply@records.healthhub.app>\r\n` +
    `Reply-To: noreply@records.healthhub.app\r\n` +
    `Subject: ${subject}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n` +
    `Content-Transfer-Encoding: 8bit\r\n` +
    `\r\n` +
    body;
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(message));
      controller.close();
    },
  });
}

export async function handleInboundEmail(
  message: CFEmailMessage,
  env: Env,
  ctx?: { waitUntil?: (p: Promise<unknown>) => void }
): Promise<void> {
  const db = env.DB;

  // 1. Resolve sender + recipient.
  const fromEmail = emailFromAddress(message.from);
  const toAlias = aliasFromAddress(message.to);

  let recipient = null as null | {
    userId: string;
    email: string | null;
    patientId: string;
  };
  let source: Source | null = null;

  if (toAlias) {
    recipient = await findUserByAlias(db, toAlias);
    if (recipient) source = "email-alias";
  }

  // Legacy path: from a known user's verified email address.
  if (!recipient && fromEmail) {
    recipient = await findUserByEmail(db, fromEmail);
    if (recipient) source = "email-from";
  }

  // Anti-enumeration: drop silently. No reply, no error. CF considers
  // a successful return as "delivered" — we want that for known users
  // and don't want to leak which addresses exist.
  if (!recipient || !source) {
    return;
  }

  // 2. Parse the MIME stream.
  const parsed = await PostalMime.parse(message.raw as ReadableStream<Uint8Array>);

  // postal-mime lower-cases header names. CF exposes `messageId` (or
  // we fall back to a per-event hash).
  const emailMessageId =
    (parsed.messageId as string | undefined) ||
    (parsed.headers.get("message-id") as string | undefined) ||
    `${recipient.patientId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;

  // 3. Process attachments. `processInboundEmail` is idempotent on
  //    `emailMessageId`.
  const subject = parsed.subject || "Email import";

  const result = await processInboundEmail(
    {
      R2: env.R2,
      DB: db,
      AI: env.AI,
      EMAIL_ALIAS_DOMAIN: env.EMAIL_ALIAS_DOMAIN,
      CLASSIFY_THRESHOLD: env.CLASSIFY_THRESHOLD,
    },
    {
      userId: recipient.userId,
      email: recipient.email,
      patientId: recipient.patientId,
    },
    source,
    emailMessageId,
    subject,
    (parsed.attachments ?? []) as any,
    ctx
  );

  // 4. Ack reply — but only if the email looks "real" (had body or
  //    attachments). Bots probing aliases get nothing.
  const hasBody = !!(parsed.text && parsed.text.trim());
  const looksReal =
    result.received > 0 ||
    result.skipped > 0 ||
    hasBody;

  if (looksReal) {
    const replySubject =
      result.received > 0
        ? `Got it — ${result.received} record${result.received === 1 ? "" : "s"} added`
        : `We received your email`;
    const replyBody = buildAckReply({
      received: result.received,
      skipped: result.skipped,
      skippedNames: result.skippedNames,
      hasBody,
    });
    const stream = buildReplyStream(replySubject, replyBody);
    await message.reply({
      from: "Healthcare Records <noreply@records.healthhub.app>",
      to: fromEmail || recipient.email || "",
      raw: stream,
    });
  }
}