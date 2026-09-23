import { api } from "@/lib/api";
import {
  getFreshStepUpToken,
  useAdminStepUpStore,
} from "@/stores/adminStepUp";

/**
 * Admin fetch wrapper around `api()`. Adds the cached step-up token
 * (X-Stepup-Token) so step-up-gated mutations don't need to think
 * about headers.
 */
export type AdminApiOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  silent401?: boolean;
};

export function adminApi<T = any>(
  path: string,
  opts: AdminApiOptions = {}
): Promise<T> {
  const stepUp = getFreshStepUpToken();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (stepUp) headers["X-Stepup-Token"] = stepUp;
  return api<T>(path, { ...opts, headers });
}

// ─── Step-up prompt bridge ─────────────────────────────────
// The (admin) layout mounts <AdminStepUpSheet />, which registers an
// `open` callback here. When a mutation 401s with `step_up_required`
// we try the dev step-up endpoint first (no UI in dev), then fall
// back to the password sheet in production. Waiters are queued so a
// burst of gated actions only prompts once.

let openPrompt: (() => void) | null = null;
let waiters: {
  resolve: (token: string) => void;
  reject: (err: Error) => void;
}[] = [];
let prompting = false;

export function registerStepUpPrompt(open: () => void): () => void {
  openPrompt = open;
  return () => {
    if (openPrompt === open) openPrompt = null;
  };
}

export function resolveStepUpPrompt(token: string): void {
  const pending = waiters;
  waiters = [];
  prompting = false;
  pending.forEach((w) => w.resolve(token));
}

export function cancelStepUpPrompt(): void {
  const pending = waiters;
  waiters = [];
  prompting = false;
  pending.forEach((w) => w.reject(new Error("Verification cancelled")));
}

function requestStepUp(): Promise<string> {
  return new Promise((resolve, reject) => {
    waiters.push({ resolve, reject });
    if (prompting) return;
    prompting = true;
    // Dev fast-path: the seeded admin can mint a step-up token without
    // a password when the API runs with DEV_MODE / localhost.
    adminApi<{ ok: boolean; stepUpToken?: string }>(
      "/admin/webauthn/dev-stepup",
      { method: "POST", silent401: true }
    )
      .then((res) => {
        if (res?.stepUpToken) {
          useAdminStepUpStore.getState().setToken(res.stepUpToken, 5 * 60);
          resolveStepUpPrompt(res.stepUpToken);
        } else {
          openPrompt?.();
          if (!openPrompt) cancelStepUpPrompt();
        }
      })
      .catch(() => {
        openPrompt?.();
        if (!openPrompt) cancelStepUpPrompt();
      });
  });
}

/** Manually trigger the step-up flow (dev token fast-path → password sheet). */
export function ensureStepUp(): Promise<string> {
  if (getFreshStepUpToken()) return Promise.resolve(getFreshStepUpToken()!);
  return requestStepUp();
}

/**
 * Like `adminApi` but transparently acquires a step-up token once when
 * the server answers `step_up_required` / `step_up_invalid`.
 */
export async function adminApiWithStepUp<T = any>(
  path: string,
  opts: AdminApiOptions = {}
): Promise<T> {
  try {
    return await adminApi<T>(path, opts);
  } catch (e: any) {
    const code = e?.code;
    const needsStepUp =
      e?.status === 401 && (code === "step_up_required" || code === "step_up_invalid");
    if (!needsStepUp) throw e;
    await requestStepUp();
    return adminApi<T>(path, opts);
  }
}

/** True when the error came back as a step-up challenge. */
export function isStepUpError(e: any): boolean {
  return (
    e?.status === 401 &&
    (e?.code === "step_up_required" || e?.code === "step_up_invalid")
  );
}
