import type { Context, Next } from "hono";
import { parseAcceptLanguage, type Locale } from "../lib/locale";

/**
 * Resolve the request locale from Accept-Language and stash it on the
 * context for downstream handlers (validation translation, future
 * per-locale formatting).
 */
export async function localeMiddleware(c: Context, next: Next) {
  const header = c.req.header("accept-language");
  const locale: Locale = parseAcceptLanguage(header);
  c.set("locale", locale);
  c.header("X-Locale", locale);
  await next();
}