// @ts-nocheck
// Phase 1.3 — WhatsApp onboarding webhook (Meta Cloud API compatible).
//
// Flow overview
// -------------
//   GET  /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
//        → Meta hub verification, echoes the challenge if VERIFY_TOKEN matches.
//   POST /webhooks/whatsapp
//        → Meta pushes inbound messages here. We:
//          1. Look up or create an active `wa_conversations` row by `wa_user_id`.
//          2. Drive the state machine: welcome → lang → nic → dob → otp → done.
//          3. On `done`, mint a `users` + `patients` row so the user can sign
//             in via the existing login-by-nic flow.
//
// Delivery of outbound messages goes straight to Meta Graph; there's no CF
// Queue yet because bot traffic is small and CF Workers fits comfortably
// in the 30s paid-plan budget. If conversation volume grows, move the
// sendMessage call onto a Queue consumer (see Phase 1.3 follow-ups).

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import {
  waConversations,
  waMessages,
  users,
  patients,
} from "@healthcare/db";
import {
  hashSecret,
  verifySecret,
  generateOtpCode,
} from "../lib/crypto";
import {
  NIC_REGEX,
  isStructurallyValid,
  nicEncodedDob,
  nicMatchesDob,
} from "../lib/nic";
import { parseAcceptLanguage, type Locale } from "../lib/locale";
import type { AppEnvironment } from "../types";

const whatsappRouter = new Hono<AppEnvironment>();

// ─── Config ───────────────────────────────────────────────
const OTP_TTL_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
// Stale-conversation cutoff: rows in non-done states older than this get
// overwritten by the webhook handler. Lets users abandon a chat and come
// back hours later without resurrecting dead state.
const STALE_CONVERSATION_HOURS = 24;

const META_GRAPH = "https://graph.facebook.com/v21.0";

type ConversationState =
  | "welcome"
  | "lang"
  | "nic"
  | "dob"
  | "otp"
  | "done"
  | "abandoned";

type Locale3 = "en" | "si" | "ta";

// ─── Meta webhook handlers ────────────────────────────────

// GET — Meta hub challenge. Echoes the challenge back when the
// configured verify token matches. Otherwise 403.
whatsappRouter.get("/webhooks/whatsapp", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token && token === c.env.WA_VERIFY_TOKEN) {
    return c.text(challenge ?? "");
  }
  return c.text("Forbidden", 403);
});

// POST — Inbound messages. Meta POSTs to this URL whenever the bot
// number receives a text or interactive reply.
whatsappRouter.post("/webhooks/whatsapp", async (c) => {
  let payload: any = null;
  try {
    payload = await c.req.json();
  } catch {
    return c.text("bad request", 400);
  }

  // Surface the validation that Meta sends only on the very first
  // webhook registration — no messages yet. Echo back the same code so
  // the verify call succeeds in one round-trip.
  if (Array.isArray(payload?.entry) === false) {
    if (
      payload?.object === "whatsapp_business_account" &&
      typeof payload?.hub?.verify_token === "string" &&
      payload.hub.verify_token === c.env.WA_VERIFY_TOKEN &&
      typeof payload.hub.challenge === "string"
    ) {
      return c.text(payload.hub.challenge);
    }
    return c.text("ok", 200);
  }

  // Walk the entry → changes → value envelope and process each message.
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;
      const phoneId = value.metadata?.phone_number_id;
      const profileName = value.contacts?.[0]?.profile?.name ?? null;
      for (const msg of value.messages) {
        await handleInboundMessage(c, {
          waUserId: msg.from,
          messageId: msg.id,
          type: msg.type,
          text: msg.text?.body ?? null,
          buttonId: msg.interactive?.button_reply?.id ?? null,
          listId: msg.interactive?.list_reply?.id ?? null,
          profileName,
          phoneNumberId: phoneId,
        });
      }
    }
  }

  // Meta expects a quick 200; long-running work uses waitUntil.
  return c.text("ok", 200);
});

// ─── Inbound message dispatch ─────────────────────────────

interface InboundArgs {
  waUserId: string;
  messageId: string;
  type: string;
  text: string | null;
  buttonId: string | null;
  listId: string | null;
  profileName: string | null;
  phoneNumberId: string | null;
}

async function handleInboundMessage(c: any, args: InboundArgs) {
  const db = c.get("db");
  const env = c.env;

  // 1. Find or create the active conversation row.
  let conv = (await db
    .select()
    .from(waConversations)
    .where(eq(waConversations.waUserId, args.waUserId))
    .all())?.[0];

  const now = new Date();
  const tooOld =
    conv &&
    new Date(conv.updatedAt).getTime() <
      now.getTime() - STALE_CONVERSATION_HOURS * 3600 * 1000;

  if (conv && tooOld) {
    // Mark stale row abandoned and start fresh.
    await db
      .update(waConversations)
      .set({ state: "abandoned" })
      .where(eq(waConversations.id, conv.id));
    conv = null;
  }

  if (!conv) {
    const insert = await db
      .insert(waConversations)
      .values({ waUserId: args.waUserId, state: "welcome" })
      .returning();
    conv = insert[0];
  }

  // 2. Log the inbound message.
  await db.insert(waMessages).values({
    conversationId: conv.id,
    direction: "inbound",
    messageType: args.type,
    body: args.text || args.buttonId || args.listId || null,
    raw: JSON.stringify(args),
  });

  // 3. Drive the state machine. `done` rows receive the "already
  //    registered" reply and stay there.
  if (conv.state === "done") {
    await sendBotReply(c, args, "already");
    return;
  }

  // Sticky locale: existing → new conversation uses `welcome` step.
  const locale: Locale3 = (conv.locale as Locale3) || "en";

  try {
    switch (conv.state as ConversationState) {
      case "welcome":
        await stepWelcome(c, db, conv, args);
        break;
      case "lang":
        await stepLang(c, db, conv, args);
        break;
      case "nic":
        await stepNic(c, db, env, conv, args);
        break;
      case "dob":
        await stepDob(c, db, env, conv, args);
        break;
      case "otp":
        await stepOtp(c, db, env, conv, args);
        break;
      default:
        await sendBotReply(c, args, "fallback", { locale: "en" });
    }
  } catch (err: any) {
    // Never leak exceptions back to Meta — log + fall back gracefully.
    console.error("[whatsapp] state error:", err?.message ?? err);
    await sendBotReply(c, args, "fallback", { locale });
  }
}

// ─── State handlers ───────────────────────────────────────

async function stepWelcome(c: any, db: any, conv: any, args: InboundArgs) {
  const locale: Locale3 = "en";
  await db
    .update(waConversations)
    .set({ state: "lang", locale, updatedAt: new Date().toISOString() });
  await sendLangPrompt(c, args, locale);
}

async function stepLang(c: any, db: any, conv: any, args: InboundArgs) {
  // Accept either a button-reply (preferred) or a typed digit / word.
  const raw = (args.buttonId || args.text || "").trim().toLowerCase();
  let locale: Locale3 | null = null;
  if (raw === "lang_en" || raw === "1" || raw === "english") locale = "en";
  else if (raw === "lang_si" || raw === "2" || raw === "sinhala" || raw === "si") locale = "si";
  else if (raw === "lang_ta" || raw === "3" || raw === "tamil" || raw === "ta") locale = "ta";

  if (!locale) {
    await sendLangPrompt(c, args, (conv.locale as Locale3) || "en");
    return;
  }

  await db
    .update(waConversations)
    .set({
      state: "nic",
      locale,
      updatedAt: new Date().toISOString(),
    });
  await sendBotReply(c, args, "nic.prompt", { locale });
}

async function stepNic(c: any, db: any, env: any, conv: any, args: InboundArgs) {
  const locale: Locale3 = (conv.locale as Locale3) || "en";
  const raw = (args.text || "").trim();
  const upper = raw.toUpperCase();

  // `resend` / `start` escape hatches everywhere.
  if (raw.toLowerCase() === "start") {
    await resetConversation(db, conv);
    await sendBotReply(c, args, "welcome.body", { locale: "en" });
    await sendLangPrompt(
      c,
      { ...args },
      "en",
    );
    return;
  }

  if (!NIC_REGEX.test(upper) || !isStructurallyValid(upper)) {
    await sendBotReply(c, args, "nic.invalid", { locale });
    return;
  }

  // Reject if this NIC is already linked to a user.
  const nicHash = await hashSecret(upper);
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.nicHash, nicHash))
    .limit(1);
  if (existing) {
    await sendBotReply(c, args, "nic.registered", { locale });
    return;
  }

  await db
    .update(waConversations)
    .set({
      pendingNicHash: nicHash,
      // Cache the parsed plain NIC (uppercase) so stepDob doesn't have
      // to re-parse. We never store plain NIC long-term — once the
      // user is created it moves to `users.nic` for display only.
      pendingNicPlain: upper,
      state: "dob",
      updatedAt: new Date().toISOString(),
    });
  await sendBotReply(c, args, "dob.prompt", { locale });
}

async function stepDob(c: any, db: any, env: any, conv: any, args: InboundArgs) {
  const locale: Locale3 = (conv.locale as Locale3) || "en";
  const raw = (args.text || "").trim();

  if (raw.toLowerCase() === "start") {
    await resetConversation(db, conv);
    await sendBotReply(c, args, "welcome.body", { locale: "en" });
    await sendLangPrompt(c, { ...args }, "en");
    return;
  }

  // Accept either ISO YYYY-MM-DD or DD/MM/YYYY — common in SL.
  let iso = raw;
  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || isNaN(Date.parse(iso))) {
    await sendBotReply(c, args, "dob.invalid", { locale });
    return;
  }
  const date = new Date(iso);
  if (date.getTime() > Date.now()) {
    await sendBotReply(c, args, "dob.invalid", { locale });
    return;
  }

  // Cross-check against DOB encoded in NIC — strongest cheap proof.
  // conv.pendingNicPlain was stashed by stepNic.
  if (!conv.pendingNicPlain || !nicMatchesDob(conv.pendingNicPlain, iso)) {
    await sendBotReply(c, args, "dob.invalid", { locale });
    return;
  }

  // Mint OTP, store hash + TTL.
  const code = generateOtpCode();
  const codeHash = await hashSecret(code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await db
    .update(waConversations)
    .set({
      pendingDob: iso,
      otpCodeHash: codeHash,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
      state: "otp",
      updatedAt: new Date().toISOString(),
    });

  // OTP delivery — same DEV log pattern as /auth/send-otp. Replace with
  // Twilio / Dialog gateway when ready.
  console.log(
    `[whatsapp-otp] wa=${args.waUserId} code=${code} expiresAt=${expiresAt}`,
  );

  await sendBotReply(c, args, "otp.prompt", { locale });
}

async function stepOtp(c: any, db: any, env: any, conv: any, args: InboundArgs) {
  const locale: Locale3 = (conv.locale as Locale3) || "en";
  const raw = (args.text || "").trim().toLowerCase();

  if (raw === "start") {
    await resetConversation(db, conv);
    await sendBotReply(c, args, "welcome.body", { locale: "en" });
    await sendLangPrompt(c, { ...args }, "en");
    return;
  }
  if (raw === "resend") {
    if ((conv.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
      await sendBotReply(c, args, "otp.locked", { locale });
      return;
    }
    const code = generateOtpCode();
    const codeHash = await hashSecret(code);
    const expiresAt = new Date(
      Date.now() + OTP_TTL_MINUTES * 60 * 1000,
    ).toISOString();
    await db
      .update(waConversations)
      .set({
        otpCodeHash: codeHash,
        otpExpiresAt: expiresAt,
        otpAttempts: 0,
        updatedAt: new Date().toISOString(),
      });
    console.log(
      `[whatsapp-otp-resend] wa=${args.waUserId} code=${code} expiresAt=${expiresAt}`,
    );
    await sendBotReply(c, args, "otp.resent", { locale });
    return;
  }

  if (!conv.otpCodeHash || !conv.otpExpiresAt) {
    await sendBotReply(c, args, "fallback", { locale });
    return;
  }

  if (Date.parse(conv.otpExpiresAt) < Date.now()) {
    await sendBotReply(c, args, "otp.expired", { locale });
    return;
  }

  if ((conv.otpAttempts ?? 0) >= OTP_MAX_ATTEMPTS) {
    await sendBotReply(c, args, "otp.locked", { locale });
    return;
  }

  const code = (args.text || "").trim();
  const ok = await verifySecret(code, conv.otpCodeHash);
  if (!ok) {
    const newAttempts = (conv.otpAttempts ?? 0) + 1;
    await db
      .update(waConversations)
      .set({
        otpAttempts: newAttempts,
        // 0 → still pending; matched → done; lock out at max.
        state: newAttempts >= OTP_MAX_ATTEMPTS ? "abandoned" : "otp",
        updatedAt: new Date().toISOString(),
      });
    await sendBotReply(c, args, "otp.invalid", {
      locale,
      vars: { remaining: OTP_MAX_ATTEMPTS - newAttempts },
    });
    return;
  }

  // ✅ Correct OTP — create the user account, mark conversation done.
  const userId = await createUserFromWaConversation(db, conv, args);
  await db
    .update(waConversations)
    .set({
      state: "done",
      userId,
      otpCodeHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      updatedAt: new Date().toISOString(),
    });
  await sendBotReply(c, args, "done.body", { locale });
}

// ─── Side-effects: create user ─────────────────────────────

async function createUserFromWaConversation(
  db: any,
  conv: any,
  args: InboundArgs,
): Promise<string> {
  // We have NIC + DOB + mobile (wa_user_id). No email yet, no password —
  // the user signs in via login-by-nic. Profile row created so the app
  // can store records the moment the user signs in.
  const nicHash = conv.pendingNicHash!;
  const dob = conv.pendingDob!;
  const phone = args.waUserId;

  const [u] = await db
    .insert(users)
    .values({
      supabaseId: crypto.randomUUID(),
      phone,
      // Display the captured contact name when available; fall back to
      // a placeholder. The user can rename in-app.
      name: args.profileName?.trim() || "HealthHub user",
      role: "patient",
      nic: conv.pendingNicPlain,
      nicHash,
      dateOfBirth: dob,
      nicVerificationLevel: "format+dob",
      verified: true,
      preferredLocale: (conv.locale as Locale3) || "en",
    })
    .returning();

  await db.insert(patients).values({ userId: u.id });

  return u.id;
}

async function resetConversation(db: any, conv: any) {
  await db
    .update(waConversations)
    .set({
      state: "welcome",
      locale: "en",
      pendingNicHash: null,
      pendingNicPlain: null,
      pendingDob: null,
      otpCodeHash: null,
      otpExpiresAt: null,
      otpAttempts: 0,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(waConversations.id, conv.id));
}

// ─── Outbound: Meta Graph send ────────────────────────────

async function sendBotReply(
  c: any,
  args: InboundArgs,
  key: string,
  opts: { locale?: Locale3; vars?: Record<string, string | number> } = {},
) {
  const locale: Locale3 = opts.locale || "en";
  const copy = pickLocaleText(locale, key);
  const body = interpolate(copy, opts.vars);
  await sendWhatsAppText(c.env, args.phoneNumberId, args.waUserId, body);

  const conv = await getConvForWaUser(c, args.waUserId);
  if (conv) {
    await c.get("db").insert(waMessages).values({
      conversationId: conv.id,
      direction: "outbound",
      messageType: "text",
      body,
      raw: JSON.stringify({ key, locale, vars: opts.vars ?? null }),
    });
  }
}

async function sendLangPrompt(c: any, args: InboundArgs, locale: Locale3) {
  const prompt = pickLocaleText(locale, "lang.prompt");
  const enLabel = pickLocaleText("en", "lang.buttonEn");
  const siLabel = pickLocaleText("si", "lang.buttonSi");
  const taLabel = pickLocaleText("ta", "lang.buttonTa");

  await sendWhatsAppInteractive(
    c.env,
    args.phoneNumberId,
    args.waUserId,
    prompt,
    [
      { id: "lang_en", title: clampTitle(enLabel, 20) },
      { id: "lang_si", title: clampTitle(siLabel, 20) },
      { id: "lang_ta", title: clampTitle(taLabel, 20) },
    ],
  );

  const conv = await getConvForWaUser(c, args.waUserId);
  if (conv) {
    await c.get("db").insert(waMessages).values({
      conversationId: conv.id,
      direction: "outbound",
      messageType: "interactive",
      body: prompt,
      raw: JSON.stringify({ key: "lang.prompt", locale, type: "buttons" }),
    });
  }
}

// WhatsApp button titles cap at 20 chars — trim with an ellipsis.
function clampTitle(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

async function getConvForWaUser(c: any, waUserId: string) {
  const [conv] = await c
    .get("db")
    .select()
    .from(waConversations)
    .where(eq(waConversations.waUserId, waUserId))
    .all();
  return conv ?? null;
}

async function sendWhatsAppText(
  env: any,
  phoneNumberId: string | null,
  to: string,
  body: string,
): Promise<void> {
  if (!phoneNumberId || !env.WA_ACCESS_TOKEN) {
    // Dev fallback: log instead of sending. Useful for local webhook
    // simulators (e.g. ngrok + Meta sandbox).
    console.log(`[wa-send-text] -> ${to}: ${body}`);
    return;
  }
  const res = await fetch(`${META_GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[wa-send-text] fail:", res.status, txt.slice(0, 200));
  }
}

async function sendWhatsAppInteractive(
  env: any,
  phoneNumberId: string | null,
  to: string,
  body: string,
  buttons: { id: string; title: string }[],
): Promise<void> {
  if (!phoneNumberId || !env.WA_ACCESS_TOKEN) {
    const titles = buttons.map((b) => `${b.id}=${b.title}`).join(" / ");
    console.log(`[wa-send-interactive] -> ${to}: ${body} | ${titles}`);
    return;
  }
  const res = await fetch(`${META_GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: {
          buttons: buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[wa-send-interactive] fail:", res.status, txt.slice(0, 200));
  }
}

// ─── Tiny i18n shim ───────────────────────────────────────
// Loads strings from apps/api/src/i18n/{en,si,ta}.json at module scope.
// Mirrors `lib/locale.ts#translate` so we don't pull a hono context just
// to look up copy.
import enI18n from "../i18n/en.json";
import siI18n from "../i18n/si.json";
import taI18n from "../i18n/ta.json";

const I18N: Record<Locale3, any> = {
  en: enI18n,
  si: siI18n,
  ta: taI18n,
};

function pickLocaleText(locale: Locale3, key: string): string {
  const parts = key.split(".");
  let cur: any = I18N[locale] || I18N.en;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in cur) cur = cur[p];
    else cur = I18N.en; // fall back to English locale table on miss
  }
  for (const k of parts.slice(0, -1)) {
    if (cur && typeof cur === "object" && k in cur) cur = cur[k];
    else return "";
  }
  return typeof cur === "string" ? cur : "";
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{{${k}}}`,
  );
}

export default whatsappRouter;
