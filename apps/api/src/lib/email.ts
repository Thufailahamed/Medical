/**
 * Email provider abstraction.
 *
 * Mirrors `lib/sms.ts`. Two providers:
 *   - ConsoleEmailProvider: dev fallback. Logs body + code to stdout.
 *   - ResendProvider: production. POSTs to https://api.resend.com/emails.
 *
 * Factory `createEmailProvider(env)` selects based on `EMAIL_PROVIDER`.
 * Default dev = "console". Production should set EMAIL_PROVIDER=resend
 * and RESEND_API_KEY via `wrangler secret put`.
 *
 * Why Resend (not CF Email Workers): CF Email Workers only *receive* email.
 * Sending needs an outbound provider; Resend has the simplest API, free
 * tier (3k/mo), and no AWS IAM dance.
 */

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailResult>;
}

/** Console-only provider for development. */
export class ConsoleEmailProvider implements EmailProvider {
  async sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailResult> {
    console.log(
      `[email:console] to=${opts.to} subject="${opts.subject}"\n${opts.text}`
    );
    return { success: true, messageId: "console-" + Date.now() };
  }
}

/** Resend HTTP API provider. https://resend.com/docs/api-reference/emails/send-email */
export class ResendProvider implements EmailProvider {
  constructor(
    private apiKey: string,
    private fromAddress: string
  ) {}

  async sendEmail(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: opts.to,
          subject: opts.subject,
          text: opts.text,
          ...(opts.html ? { html: opts.html } : {}),
        }),
      });

      const body = await res.text();
      if (!res.ok) {
        console.error(`[email:resend] HTTP ${res.status}: ${body}`);
        return { success: false, error: `HTTP ${res.status}: ${body}` };
      }

      let id: string | undefined;
      try {
        id = JSON.parse(body).id;
      } catch {
        // body wasn't JSON — surface raw text
        id = body.slice(0, 64);
      }
      console.log(`[email:resend] sent to=${opts.to} id=${id}`);
      return { success: true, messageId: id };
    } catch (err: any) {
      console.error("[email:resend] error:", err);
      return { success: false, error: err?.message ?? "Email send failed" };
    }
  }
}

/** Factory — picks the right provider based on env config. */
export function createEmailProvider(env: {
  EMAIL_PROVIDER?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}): EmailProvider {
  const provider = (env.EMAIL_PROVIDER || "console").toLowerCase();

  if (provider === "resend") {
    if (!env.RESEND_API_KEY) {
      console.warn(
        "[email] RESEND_API_KEY missing, falling back to console provider"
      );
      return new ConsoleEmailProvider();
    }
    return new ResendProvider(
      env.RESEND_API_KEY,
      env.EMAIL_FROM || "no-reply@records.healthhub.app"
    );
  }

  return new ConsoleEmailProvider();
}

/** Format OTP email body. Plain text first; HTML kept minimal for now. */
export function formatOtpEmail(code: string, purpose?: string) {
  const subject = "Your HealthHub verification code";
  const intro = purpose
    ? `Use this code to ${purpose} your HealthHub account.`
    : "Use this code to verify your HealthHub account.";
  const text =
    `${intro}\n\n` +
    `Verification code: ${code}\n\n` +
    `Valid for 5 minutes. Do not share this code.\n\n` +
    `If you did not request this code, ignore this email.`;
  const html =
    `<p>${intro}</p>` +
    `<p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${code}</p>` +
    `<p>Valid for 5 minutes. Do not share this code.</p>` +
    `<p style="color:#888;">If you did not request this code, ignore this email.</p>`;
  return { subject, text, html };
}

/**
 * Round 3 P1: post-visit summary email. Sent ~1h after an appointment
 * flips to "completed". Plain text first; HTML mirrors the same data
 * with clickable CTA. Includes a deep link to the in-app rate screen so
 * the patient can leave a 1-tap star rating.
 *
 * Body shape: doctor name, diagnosis (if any), medicines list. PHI is
 * surface-level for the patient (they're the recipient) but we still
 * avoid including clinical detail beyond what the patient already saw
 * in the visit summary.
 */
export function formatVisitSummaryEmail(args: {
  patientName: string;
  doctorName: string;
  diagnosis?: string | null;
  medicines: string[];
  rateUrl: string;
}) {
  const subject = `Your visit with ${args.doctorName}`;
  const meds =
    args.medicines.length > 0
      ? `Medicines prescribed:\n${args.medicines
          .map((m) => `  • ${m}`)
          .join("\n")}`
      : "No medicines were prescribed for this visit.";
  const dx = args.diagnosis ? `Reason for visit: ${args.diagnosis}\n\n` : "";
  const text =
    `Hi ${args.patientName},\n\n` +
    `Thanks for your visit with ${args.doctorName} today. Here is a short summary.\n\n` +
    `${dx}${meds}\n\n` +
    `Rate your visit (1 minute):\n${args.rateUrl}\n\n` +
    `Your feedback helps other patients find the right doctor.\n\n` +
    `— The HealthHub team`;
  const html = `
    <p>Hi ${args.patientName},</p>
    <p>Thanks for your visit with <strong>${args.doctorName}</strong> today.</p>
    ${args.diagnosis ? `<p>Reason for visit: ${args.diagnosis}</p>` : ""}
    ${
      args.medicines.length > 0
        ? `<p><strong>Medicines prescribed:</strong></p><ul>${args.medicines
            .map((m) => `<li>${m}</li>`)
            .join("")}</ul>`
        : "<p>No medicines were prescribed for this visit.</p>"
    }
    <p><a href="${args.rateUrl}" style="display:inline-block;padding:12px 20px;background:#1a73e8;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Rate your visit</a></p>
    <p style="color:#888;font-size:12px">Your feedback helps other patients find the right doctor.</p>
  `;
  return { subject, text, html };
}