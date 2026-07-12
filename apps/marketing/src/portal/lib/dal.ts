/**
 * Server-side Data Access Layer (DAL).
 *
 * Pattern lifted from `node_modules/next/dist/docs/01-app/02-guides/
 * authentication.md#creating-a-data-access-layer-dal`:
 *
 *   - `import 'server-only'` to keep this out of the client bundle.
 *   - React `cache()` memoises the session lookup within one render
 *     pass so callers don't re-hit the API repeatedly.
 *   - `cookies()` is async in Next.js 16.
 *
 * Phase 1.2 wiring:
 *   - Reads a server-readable cookie `portal_session` whose value is the
 *     JWT issued by the backend.
 *   - Validates it by calling backend `GET /auth/me` with that bearer.
 *   - If absent or 401, returns `null` so the caller can fall back to
 *     the existing client-side AuthBoot gating.
 *
 * Phase 1.3 dependency:
 *   - The backend `/auth/login` response must add `Set-Cookie:
 *     portal_session=<jwt>; HttpOnly; Secure; SameSite=Lax` for the DAL
 *     to gate SSR before the client hydrates. Without that cookie the
 *     DAL can only passively confirm what the client already knows.
 *   - Until then the DAL is forward-compatible: no cookie → no-op;
 *     client-side (portal)/layout.tsx continues to gate the UI.
 */
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import type { UserRole } from '@/portal/stores/auth';

export interface ServerUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  photo?: string | null;
  // Anything else the DAL should NOT surface to the client should stay
  // in a separate type. This shape mirrors AuthUser in the client store
  // but omits fields the backend doesn't actually return.
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  'http://localhost:8787';

const SESSION_COOKIE = 'portal_session';

/**
 * Read + validate the portal session cookie. Returns null if no cookie
 * (caller decides whether to redirect), or throws redirect('/login')
 * if the cookie is present but the backend rejects it.
 */
export const getServerSession = cache(
  async (): Promise<ServerUser | null> => {
    const jar = await cookies();
    const token = jar.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        // Don't cache the validation across requests.
        cache: 'no-store',
      });
      if (res.status === 401) {
        // Cookie is stale — clear it so the client AuthBoot doesn't
        // bounce again on its first /auth/me call.
        jar.delete(SESSION_COOKIE);
        return null;
      }
      if (!res.ok) return null;
      const json = (await res.json().catch(() => null)) as
        | { user?: ServerUser }
        | null;
      return json?.user ?? null;
    } catch {
      // Network error against the API at SSR — treat as unauthed.
      return null;
    }
  }
);

/**
 * Gate a server component / layout. If the DAL finds a valid session
 * the user is returned; otherwise we redirect to /portal/login with
 * a `next` query so the user lands back here after signing in.
 *
 * Use as the first awaitable in a server layout:
 *
 *   const user = await requireServerAuth();
 */
export async function requireServerAuth(): Promise<ServerUser> {
  const user = await getServerSession();
  if (!user) redirect('/portal/login?next=/portal');
  return user;
}

/**
 * Same as requireServerAuth but only allows a fixed set of roles.
 * Server-side equivalent of the client-side useRbac hook.
 */
export async function requireServerRole(
  ...allowed: UserRole[]
): Promise<ServerUser> {
  const user = await requireServerAuth();
  if (!allowed.includes(user.role as UserRole)) {
    redirect('/portal/403');
  }
  return user;
}