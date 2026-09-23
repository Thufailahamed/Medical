import { create } from "zustand";

// Step-up token cache for the admin surface. The API issues 5-minute
// tokens from /admin/webauthn/password-stepup (or a passkey assertion on
// web). We keep it in memory only — never persisted — so a fresh proof
// is required after every app restart.
interface AdminStepUpState {
  token: string | null;
  expiresAt: number; // epoch ms
  setToken: (token: string, expiresInSeconds: number) => void;
  clear: () => void;
}

export const useAdminStepUpStore = create<AdminStepUpState>((set) => ({
  token: null,
  expiresAt: 0,
  setToken: (token, expiresInSeconds) =>
    set({ token, expiresAt: Date.now() + expiresInSeconds * 1000 }),
  clear: () => set({ token: null, expiresAt: 0 }),
}));

export function getFreshStepUpToken(): string | null {
  const { token, expiresAt } = useAdminStepUpStore.getState();
  // 10s grace so a token doesn't expire mid-flight.
  if (token && expiresAt - 10_000 > Date.now()) return token;
  return null;
}
