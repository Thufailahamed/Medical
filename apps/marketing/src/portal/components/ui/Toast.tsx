"use client";

import { create } from "zustand";
import { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/portal/lib/utils";

type Tone = "success" | "error" | "info";

interface Toast {
  id: string;
  tone: Tone;
  title: string;
  body?: string;
  ttl: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "ttl"> & { ttl?: number }) => string;
  dismiss: (id: string) => void;
}

const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: ({ tone, title, body, ttl }) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, tone, title, body, ttl: ttl ?? 4000 };
    set((s) => ({ toasts: [...s.toasts, toast] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Imperative toast helpers — usable from any client component. */
export const toast = {
  success: (title: string, body?: string) =>
    useToastStore.getState().push({ tone: "success", title, body }),
  error: (title: string, body?: string) =>
    useToastStore.getState().push({ tone: "error", title, body }),
  info: (title: string, body?: string) =>
    useToastStore.getState().push({ tone: "info", title, body }),
};

const toneConfig = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
    iconColor: "text-emerald-600",
  },
  error: {
    icon: AlertCircle,
    bg: "bg-red-50",
    border: "border-l-red-500",
    iconColor: "text-red-600",
  },
  info: {
    icon: Info,
    bg: "bg-sky-50",
    border: "border-l-sky-500",
    iconColor: "text-sky-600",
  },
};

/** Mount this once near the top of the tree. */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      className="portal-toast-host pointer-events-none fixed bottom-5 right-5 z-[210] flex w-[min(22rem,calc(100vw-2.5rem))] flex-col-reverse gap-2"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const cfg = toneConfig[toast.tone];
  const Icon = cfg.icon;
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.ttl);
    return () => clearTimeout(id);
  }, [toast.id, toast.ttl, dismiss]);
  return (
    <div
      className={cn(
        "portal-toast-card pointer-events-auto flex items-start gap-3 rounded-2xl border border-border/70 bg-surface px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.12)] border-l-[3px] animate-in",
        cfg.border
      )}
      role="status"
    >
      <div className={cn("portal-toast-icon mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl", cfg.bg)}>
        <Icon size={15} className={cfg.iconColor} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-text">{toast.title}</div>
        {toast.body ? (
          <div className="mt-0.5 text-xs leading-relaxed text-text-muted">{toast.body}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="portal-toast-dismiss inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
