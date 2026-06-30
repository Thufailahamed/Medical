// apps/api/src/lib/html-escape.ts
// Minimal HTML entity escaper. Use for every interpolated user-supplied
// value rendered into the invite landing page — names, relationships,
// inviter names, expiry strings — anything that ultimately lands between
// tags or in an attribute. Defends against stored-XSS via DB-driven
// invite creation (e.g. a principal enters `<img onerror=...>` as a
// relative's name; a recipient opening the link should never trigger it).

const REPLACEMENTS: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "/": "&#x2F;",
};

export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input).replace(/[&<>"'\/]/g, (ch) => REPLACEMENTS[ch]);
}

/**
 * Escape for use inside an HTML attribute that is a single-quoted string.
 * Same as escapeHtml — provided as a named helper so call sites read
 * clearly when interpolating URL params, IDs, etc.
 */
export function escapeAttr(input: unknown): string {
  return escapeHtml(input);
}