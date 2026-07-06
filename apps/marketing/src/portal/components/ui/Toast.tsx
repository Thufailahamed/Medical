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
    <div className="pointer-events-none fixed top-3 right-3 z-[60] flex flex-col gap-2 w-[min(380px,90vw)]">
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
        "pointer-events-auto rounded-2xl bg-surface border border-border/70 shadow-[0_12px_40px_rgba(0,0,0,0.08)] px-4 py-3 flex items-start gap-3 border-l-[3px] animate-in",
        cfg.border
      )}
      role="status"
      aria-live="polite"
    >
      <div className={cn("mt-0.5 h-7 w-7 rounded-xl flex items-center justify-center shrink-0", cfg.bg)}>
        <Icon size={15} className={cfg.iconColor} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text">{toast.title}</div>
        {toast.body ? (
          <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{toast.body}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="text-text-muted hover:text-text h-6 w-6 flex items-center justify-center rounded-lg hover:bg-surface-2 transition-colors"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}
