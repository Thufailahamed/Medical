"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Sun, Moon, Monitor, Languages, Check } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useAuthStore } from "@/portal/stores/auth";
import { setLocale } from "@/portal/lib/auth";
import type { Locale } from "@/portal/stores/auth";

const LOCALES: Array<{ value: Locale; label: string; native: string }> = [
  { value: "en", label: "English", native: "English" },
  { value: "si", label: "Sinhala", native: "සිංහල" },
  { value: "ta", label: "Tamil", native: "தமிழ்" },
];

export default function AppearanceSettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const storeLocale = useAuthStore((s) => s.locale);
  const [theme, setTheme] = useState<"light" | "dark" | "system">("light");
  const [locale, setLocalLocale] = useState<Locale>(storeLocale ?? "en");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = (localStorage.getItem("pref-theme") as "light" | "dark" | "system" | null) ?? "light";
    const d = (localStorage.getItem("pref-density") as "comfortable" | "compact" | null) ?? "comfortable";
    const m = localStorage.getItem("pref-reduced-motion") === "1";
    setTheme(t);
    setDensity(d);
    setReducedMotion(m);
  }, []);

  function save(next: {
    theme?: "light" | "dark" | "system";
    density?: "comfortable" | "compact";
    reducedMotion?: boolean;
    locale?: Locale;
  }) {
    if (typeof window !== "undefined") {
      if (next.theme) localStorage.setItem("pref-theme", next.theme);
      if (next.density) localStorage.setItem("pref-density", next.density);
      if (next.reducedMotion !== undefined) {
        localStorage.setItem("pref-reduced-motion", next.reducedMotion ? "1" : "0");
      }
    }
    if (next.locale) {
      setLocale(next.locale);
      setLocalLocale(next.locale);
    }
    if (next.theme) setTheme(next.theme);
    if (next.density) setDensity(next.density);
    if (next.reducedMotion !== undefined) setReducedMotion(next.reducedMotion);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/profile"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to profile
      </Link>

      <SectionHeader
        label="Settings"
        title="Appearance & language"
        description="Tune how the portal looks and what language it uses. Your preferences are saved to this device."
        action={
          saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <Check size={12} aria-hidden /> Saved
            </span>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-text">Theme</h2>
          <p className="text-xs text-text-soft">
            Choose a theme. System follows your device settings.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ThemeOption
              icon={<Sun size={18} aria-hidden />}
              label="Light"
              description="Bright and clear"
              active={theme === "light"}
              onClick={() => save({ theme: "light" })}
            />
            <ThemeOption
              icon={<Moon size={18} aria-hidden />}
              label="Dark"
              description="Easy on the eyes"
              active={theme === "dark"}
              onClick={() => save({ theme: "dark" })}
            />
            <ThemeOption
              icon={<Monitor size={18} aria-hidden />}
              label="System"
              description="Match device"
              active={theme === "system"}
              onClick={() => save({ theme: "system" })}
            />
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Languages size={16} aria-hidden className="text-brand" />
            <h2 className="text-sm font-bold text-text">Language</h2>
          </div>
          <p className="text-xs text-text-soft">
            The portal can switch between English, Sinhala, and Tamil. Some
            sections are still being translated.
          </p>
          <div className="flex flex-wrap gap-2">
            {LOCALES.map((l) => (
              <button
                key={l.value}
                type="button"
                onClick={() => save({ locale: l.value })}
                className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${
                  locale === l.value
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-1 text-text hover:border-brand hover:bg-brand-soft"
                }`}
              >
                {l.native}
                <span className="ml-1 text-xs opacity-70">({l.label})</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-bold text-text">Display</h2>
          <div>
            <p className="t-label">Density</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => save({ density: "comfortable" })}
                className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${
                  density === "comfortable"
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-1 text-text hover:border-brand"
                }`}
              >
                Comfortable
              </button>
              <button
                type="button"
                onClick={() => save({ density: "compact" })}
                className={`rounded-pill border px-4 py-2 text-sm font-semibold transition-colors ${
                  density === "compact"
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface-1 text-text hover:border-brand"
                }`}
              >
                Compact
              </button>
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm text-text">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => save({ reducedMotion: e.target.checked })}
              className="h-4 w-4 rounded border-border text-brand"
            />
            Reduce motion (honor system preference)
          </label>
        </div>
      </Card>
    </div>
  );
}

function ThemeOption({
  icon,
  label,
  description,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-2 rounded-inner border p-4 text-left transition-colors ${
        active
          ? "border-brand bg-brand-soft"
          : "border-[color:var(--color-border)] bg-surface-1 hover:border-brand"
      }`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-pill ${
          active ? "bg-brand text-white" : "bg-surface-3 text-text-soft"
        }`}
      >
        {icon}
      </span>
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className="text-xs text-text-muted">{description}</p>
    </button>
  );
}
