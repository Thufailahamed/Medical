// apps/api/src/routes/invite-page.ts
// Phase 2.3.2: GET /invite/:token → HTML landing page.
//
// Recipient flow:
//   - Mobile with app installed: existing expo-router route at
//     /invite/[token] resolves inside the bundle via healthcare://.
//     Browser User-Agents land here instead.
//   - Browser / no app: this HTML page renders the invite summary,
//     offers "Open in app" (healthcare:// scheme), and links to the
//     App Store / Play Store so a fresh install can complete the flow.
//
// Output: text/html; charset=utf-8. OG meta tags make Slack/WhatsApp
// previews unfurl a sensible card.
//
// Auth: NONE. The page is public — same as the JSON preview endpoint.
// We only ever return the safe bundle (inviter name/photo, invitee
// name + relationship, expiry, consumed flag). No patientId, no
// inviterId, no internal IDs leak.

import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { shareLinks, users } from "@healthcare/db";
import { parseAcceptLanguage, translate } from "../lib/locale";
import { writeAudit } from "../lib/audit";
import { formatLocalDate } from "../lib/timezone";
import { escapeHtml, escapeAttr } from "../lib/html-escape";
import type { AppEnvironment } from "../types";

const invitePageRouter = new Hono<AppEnvironment>();

// D2: the public URL is mounted at root, not under /family.
invitePageRouter.get("/invite/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  if (!token) {
    return c.html(renderInvalidPage(c.env, "missing"), 400);
  }

  const [link] = await db
    .select()
    .from(shareLinks)
    .where(
      and(eq(shareLinks.token, token), eq(shareLinks.kind, "family_invite"))
    )
    .limit(1);

  if (!link) {
    return c.html(renderInvalidPage(c.env, "notFound"), 404);
  }
  if (link.revoked) {
    return c.html(renderInvalidPage(c.env, "revoked"), 410);
  }
  if (new Date(link.expiresAt) < new Date()) {
    return c.html(renderInvalidPage(c.env, "expired"), 410);
  }

  const [inviter] = await db
    .select({ name: users.name, photo: users.photo })
    .from(users)
    .where(eq(users.id, link.createdBy))
    .limit(1);

  // Same audit shape as the JSON preview — lets us correlate "user
  // tapped the web link" with the eventual accept.
  await writeAudit(db, {
    userId: null,
    action: "family_invite_viewed",
    resource: "share_link",
    resourceId: link.id,
    details: {
      surface: "web",
      ip: c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || null,
      ua: c.req.header("user-agent") || null,
    },
  });

  // Browser-driven locale resolution. Chat crawlers see en by design.
  const locale = parseAcceptLanguage(c.req.header("accept-language"));
  const scope = parseScope(link.scope);
  const inviterName = inviter?.name ?? translate(locale, "family.invitePage.someone", "Someone");
  const inviteeName = scope.name ?? link.label ?? "";
  const relationship = scope.relationship ?? null;
  const expiresAt = link.expiresAt;

  const html = renderLandingPage({
    env: c.env,
    locale,
    token,
    inviterName,
    inviterPhoto: inviter?.photo ?? null,
    inviteeName,
    relationship,
    expiresAt,
    consumed: !!link.consumedAt,
  });

  return c.html(html, 200);
});

// ─── helpers ─────────────────────────────────────────────

function parseScope(rawScope: string | null | undefined): {
  name?: string;
  relationship?: string;
} {
  if (!rawScope) return {};
  try {
    const parsed = JSON.parse(rawScope);
    if (parsed && typeof parsed === "object") return parsed as any;
  } catch {
    // fall through
  }
  return {};
}

function t(locale: ReturnType<typeof parseAcceptLanguage>, key: string, fb: string): string {
  return translate(locale, key, fb);
}

type LandingInput = {
  env: AppEnvironment["Bindings"];
  locale: ReturnType<typeof parseAcceptLanguage>;
  token: string;
  inviterName: string;
  inviterPhoto: string | null;
  inviteeName: string;
  relationship: string | null;
  expiresAt: string;
  consumed: boolean;
};

function renderLandingPage(input: LandingInput): string {
  const {
    env,
    locale,
    token,
    inviterName,
    inviterPhoto,
    inviteeName,
    relationship,
    expiresAt,
    consumed,
  } = input;

  const publicUrl = env.PUBLIC_URL || "";
  const iosUrl = env.IOS_APP_STORE_URL || "#";
  const playUrl = env.ANDROID_PLAY_STORE_URL || "#";
  const deepLink = `healthcare://invite/${token}`;
  const canonical = `${publicUrl}/invite/${token}`;
  const expiry = escapeHtml(formatLocalDate(expiresAt));
  const safeInviter = escapeHtml(inviterName);
  const safeInvitee = escapeHtml(inviteeName || "—");
  const safeRelationship = escapeHtml(relationship || "");

  const relationshipLabel = relationship
    ? t(locale, `family.relationship.${relationship}`, relationship)
    : "";

  const title = t(locale, "family.invitePage.ogTitle", "{{name}} invited you to HealthHub").replace(
    "{{name}}",
    inviterName
  );
  const description = t(
    locale,
    "family.invitePage.ogDescription",
    "Open the link in HealthHub to accept the invite."
  );

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(title)}</title>
<link rel="canonical" href="${escapeAttr(canonical)}">
<meta name="description" content="${escapeAttr(description)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:url" content="${escapeAttr(canonical)}">
<meta property="og:image" content="${escapeAttr(`${publicUrl}/og-default.png`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0ea5e9">
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: linear-gradient(160deg, #e0f2fe 0%, #ecfeff 50%, #f0fdfa 100%);
    color: #0f172a;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  main {
    max-width: 440px;
    width: 100%;
    background: #ffffff;
    border-radius: 24px;
    box-shadow: 0 18px 50px -20px rgba(14,165,233,0.35), 0 8px 16px -8px rgba(15,23,42,0.08);
    padding: 32px 24px 28px;
    text-align: center;
  }
  .logo {
    width: 64px; height: 64px;
    border-radius: 18px;
    background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
    display: inline-flex; align-items: center; justify-content: center;
    color: #fff; font-size: 28px; font-weight: 700;
    margin-bottom: 20px;
  }
  .avatar {
    width: 72px; height: 72px;
    border-radius: 999px;
    object-fit: cover;
    border: 3px solid #fff;
    box-shadow: 0 0 0 2px #0ea5e9;
    margin: -52px auto 12px;
    background: #e0f2fe;
  }
  .inviter { font-size: 14px; color: #64748b; margin: 0 0 4px; }
  h1 { font-size: 22px; line-height: 1.3; margin: 8px 0 6px; color: #0f172a; }
  .sub { font-size: 16px; color: #334155; margin: 0 0 24px; }
  .sub strong { color: #0ea5e9; }
  .cta {
    display: block;
    width: 100%;
    padding: 14px 18px;
    border-radius: 14px;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
    margin-top: 10px;
    transition: transform 0.05s ease, box-shadow 0.15s ease;
  }
  .cta-primary {
    background: linear-gradient(135deg, #0ea5e9 0%, #14b8a6 100%);
    color: #fff;
    box-shadow: 0 6px 16px -6px rgba(14,165,233,0.6);
  }
  .cta-primary:hover { box-shadow: 0 10px 22px -6px rgba(14,165,233,0.7); }
  .cta-primary:active { transform: translateY(1px); }
  .cta-secondary {
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #e2e8f0;
  }
  .row { display: flex; gap: 8px; margin-top: 10px; }
  .row .cta { flex: 1; }
  .expires {
    margin-top: 22px;
    font-size: 12px;
    color: #94a3b8;
  }
  .pill {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 999px;
    background: #fef3c7;
    color: #92400e;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 12px;
  }
  footer {
    margin-top: 18px;
    font-size: 11px;
    color: #94a3b8;
  }
  @media (prefers-color-scheme: dark) {
    body { background: #020617; color: #e2e8f0; }
    main { background: #0f172a; box-shadow: none; border: 1px solid #1e293b; }
    h1 { color: #f1f5f9; }
    .sub { color: #cbd5e1; }
    .cta-secondary { background: #1e293b; color: #e2e8f0; border-color: #334155; }
    .inviter, .expires, footer { color: #94a3b8; }
  }
</style>
</head>
<body>
<main>
  <div class="logo" aria-hidden="true">H</div>
  ${inviterPhoto ? `<img class="avatar" src="${escapeAttr(inviterPhoto)}" alt="${escapeAttr(inviterName)}">` : ""}
  <p class="inviter">${escapeHtml(t(locale, "family.invitePage.invitedBy", "{{name}} invited you").replace("{{name}}", inviterName))}</p>
  <h1>${escapeHtml(t(locale, "family.invitePage.heroTitle", "Join HealthHub"))}</h1>
  <p class="sub">
    ${relationship ? escapeHtml(t(locale, "family.invitePage.inviteLine", "{{inviter}} wants to add you as their {{relationship}}").replace("{{inviter}}", inviterName).replace("{{relationship}}", relationshipLabel)) : escapeHtml(t(locale, "family.invitePage.inviteLineNoRel", "{{inviter}} wants to add you to their HealthHub").replace("{{inviter}}", inviterName))}
  </p>

  ${consumed ? `<span class="pill">${escapeHtml(t(locale, "family.invitePage.alreadyAccepted", "Already accepted"))}</span>` : ""}

  ${!consumed ? `<a class="cta cta-primary" href="${escapeAttr(deepLink)}">${escapeHtml(t(locale, "family.invitePage.openInApp", "Open in HealthHub"))}</a>` : ""}
  <div class="row">
    <a class="cta cta-secondary" href="${escapeAttr(iosUrl)}">${escapeHtml(t(locale, "family.invitePage.appStore", "App Store"))}</a>
    <a class="cta cta-secondary" href="${escapeAttr(playUrl)}">${escapeHtml(t(locale, "family.invitePage.playStore", "Google Play"))}</a>
  </div>
  <p class="expires">${escapeHtml(t(locale, "family.invitePage.expiresOn", "Link expires {{date}}").replace("{{date}}", expiry))}</p>

  <footer>HealthHub · ${escapeHtml(t(locale, "family.invitePage.footer", "Secure family health records"))}</footer>
</main>
<script>
  // On mobile, attempt to wake the installed app via the custom scheme.
  // Falls through silently if the OS rejects — user sees the page as-is
  // and can use the store CTAs to install.
  (function () {
    var ua = navigator.userAgent || "";
    if (/iPhone|iPad|iPod|Android/i.test(ua)) {
      var a = document.querySelector('a.cta-primary');
      if (a) a.click();
    }
  })();
</script>
</body>
</html>`;
}

type InvalidKind = "missing" | "notFound" | "revoked" | "expired";

function renderInvalidPage(env: AppEnvironment["Bindings"], kind: InvalidKind): string {
  const locale = parseAcceptLanguage(undefined);
  const publicUrl = env.PUBLIC_URL || "";
  const messages: Record<InvalidKind, { title: string; body: string }> = {
    missing: {
      title: t(locale, "family.invitePage.invalid.missingTitle", "Missing invite link"),
      body: t(locale, "family.invitePage.invalid.missingBody", "The link you opened is incomplete."),
    },
    notFound: {
      title: t(locale, "family.invitePage.invalid.notFoundTitle", "Invite not found"),
      body: t(locale, "family.invitePage.invalid.notFoundBody", "This invite doesn't exist or has been removed."),
    },
    revoked: {
      title: t(locale, "family.invitePage.invalid.revokedTitle", "Invite cancelled"),
      body: t(locale, "family.invitePage.invalid.revokedBody", "The sender cancelled this invite. Ask them for a new link."),
    },
    expired: {
      title: t(locale, "family.invitePage.invalid.expiredTitle", "Invite expired"),
      body: t(locale, "family.invitePage.invalid.expiredBody", "This invite has expired. Ask the sender to generate a fresh link."),
    },
  };
  const { title, body } = messages[kind];
  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · HealthHub</title>
<link rel="canonical" href="${escapeAttr(publicUrl)}">
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; margin: 0; }
  main { max-width: 420px; background: #fff; border-radius: 20px; box-shadow: 0 8px 24px -10px rgba(15,23,42,0.12); padding: 28px; text-align: center; }
  h1 { font-size: 20px; margin: 0 0 8px; }
  p { color: #475569; line-height: 1.5; margin: 0 0 16px; }
  a { display: inline-block; padding: 12px 18px; border-radius: 12px; background: #0ea5e9; color: #fff; text-decoration: none; font-weight: 600; }
</style>
</head>
<body>
<main>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(body)}</p>
  <a href="${escapeAttr(publicUrl)}">${escapeHtml(t(locale, "family.invitePage.invalid.homeCta", "Open HealthHub"))}</a>
</main>
</body>
</html>`;
}

export default invitePageRouter;