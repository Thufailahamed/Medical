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

const toneIcon = {
  success: <CheckCircle2 size={16} className="text-success" />,
  error: <AlertCircle size={16} className="text-danger" />,
  info: <Info size={16} className="text-brand" />,
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
  useEffect(() => {
    const id = setTimeout(() => dismiss(toast.id), toast.ttl);
    return () => clearTimeout(id);
  }, [toast.id, toast.ttl, dismiss]);
  return (
    <div
      className={cn(
        "pointer-events-auto card px-3 py-2 flex items-start gap-2 border-l-4",
        toast.tone === "success" && "border-l-success",
        toast.tone === "error" && "border-l-danger",
        toast.tone === "info" && "border-l-brand"
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mt-0.5">{toneIcon[toast.tone]}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-text">{toast.title}</div>
        {toast.body ? (
          <div className="text-xs text-text-soft mt-0.5">{toast.body}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="text-text-muted hover:text-text h-6 w-6 flex items-center justify-center"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}