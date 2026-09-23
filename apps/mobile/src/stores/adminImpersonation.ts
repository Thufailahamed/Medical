import { create } from "zustand";

// Active admin impersonation session (Phase ADM-4 parity with the web
// console). The minted JWT carries aud:"admin" so it can only be used
// by the web admin portal — mobile endpoints reject it. We keep just
// enough state to show the "session active" card and end it cleanly.
interface AdminImpersonationState {
  session: {
    targetUser: { id: string; name: string; email: string; role: string };
    expiresAt: string;
  } | null;
  start: (s: NonNullable<AdminImpersonationState["session"]>) => void;
  end: () => void;
}

export const useAdminImpersonation = create<AdminImpersonationState>((set) => ({
  session: null,
  start: (session) => set({ session }),
  end: () => set({ session: null }),
}));
