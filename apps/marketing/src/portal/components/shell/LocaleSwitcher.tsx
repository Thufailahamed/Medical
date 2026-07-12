"use client";

import { Globe, ChevronDown } from "lucide-react";
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
          "appearance-none bg-transparent border border-transparent rounded-xl pl-9 pr-7 h-10 text-xs font-semibold text-text-soft",
          "hover:bg-surface-2/60 hover:border-border/40 hover:text-text",
          "focus-ring focus:bg-white focus:border-brand/30 focus:ring-2 focus:ring-brand/10",
          "cursor-pointer transition-all duration-200"
        )}
        value={locale}
        onChange={(e) => {
          const next = e.target.value as Locale;
          setLocale(next);
          // P3.3: keep <html lang> in sync so screen readers + browser
          // hyphenation pick up the active locale.
          if (typeof document !== "undefined") {
            document.documentElement.lang = next;
          }
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Globe
        size={14}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
      <ChevronDown
        size={11}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
      />
    </div>
  );
}
