// @ts-nocheck
// Phase 1.4: ack-reply text. Worker uses CF Email Workers' reply()
// primitive — we just need the plain-text body.

export function buildAckReply(args: {
  received: number;
  skipped: number;
  skippedNames: string[];
  hasBody: boolean;
}): string {
  const { received, skipped, skippedNames, hasBody } = args;
  const lines: string[] = [];

  if (received === 0 && skipped === 0 && !hasBody) {
    // Spammy nothing-email. Encourage the sender to attach files.
    lines.push(
      "We received your email but it had no attachments or text."
    );
    lines.push(
      "Forward this email from your phone or laptop after attaching the lab report, prescription, or image you'd like to add to your records."
    );
    return lines.join("\n\n");
  }

  if (received > 0) {
    lines.push(
      `Received ${received} attachment${received === 1 ? "" : "s"}. They have been added to your records.`
    );
  } else if (hasBody) {
    lines.push(
      "We saved the email contents to your records. Open the app to add any attachments you may have forgotten."
    );
  }

  if (skipped > 0) {
    const list = skippedNames.slice(0, 5).join(", ");
    const more =
      skippedNames.length > 5 ? ` and ${skippedNames.length - 5} more` : "";
    lines.push(
      `Skipped ${skipped} attachment${skipped === 1 ? "" : "s"} over 25 MB: ${list}${more}. Try resizing or splitting.`
    );
  }

  lines.push("Open the Healthcare app to view and categorize your new records.");
  return lines.join("\n\n");
}
