/**
 * Single sign-in surface for every portal.
 * Prefer this helper over hard-coded `/patient/login` etc.
 */

export type LoginPort = "patient" | "facility" | "doctor" | "operator";

export function loginHref(opts?: {
  port?: LoginPort;
  next?: string;
  reason?: string;
}): string {
  const qs = new URLSearchParams();
  if (opts?.port) qs.set("port", opts.port);
  if (opts?.next) qs.set("next", opts.next);
  if (opts?.reason) qs.set("reason", opts.reason);
  const s = qs.toString();
  return s ? `/login?${s}` : "/login";
}

/** Infer the best port tab from the path the user was trying to reach. */
export function portForPath(path: string): LoginPort | undefined {
  if (path.startsWith("/patient")) return "patient";
  if (path.startsWith("/portal")) return "doctor";
  if (path.startsWith("/hospital") || path.startsWith("/lab-portal")) {
    return "facility";
  }
  if (
    path.startsWith("/admin") ||
    path.startsWith("/insurance-operator")
  ) {
    return "operator";
  }
  return undefined;
}

/** True for the unified login surface (and legacy routes that redirect there). */
export function isLoginPath(path: string): boolean {
  return (
    path === "/login" ||
    path === "/patient/login" ||
    path === "/portal/login" ||
    path === "/hospital/login" ||
    path === "/admin/login" ||
    path === "/lab-portal/login" ||
    path === "/insurance-operator/login"
  );
}
