"use client";

import { Globe } from "lucide-react";
import { useAuthStore, type Locale } from "@/portal/stores/auth";
import { cn } from "@/portal/lib/utils";

const options: { value: Locale; label: string; short: string }[] = [
  { value: "en", label: "English", short: "EN" },
  { value: "si", label: "සිංහල", short: "සිං" },
  { value: "ta", label: "தமிழ்", short: "த" },
];

export function LocaleSwitcher() {
  const locale = useAuthStore((s) => s.locale);
  const setLocale = useAuthStore((s) => s.setLocale);

  return (
    <div className="relative" data-testid="locale-switcher">
      <select
        aria-label="Language"
        className={cn(
          "appearance-none bg-surface border border-border rounded-md pl-7 pr-2 h-8 text-xs text-text focus-ring cursor-pointer"
        )}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Globe
        size={14}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
}