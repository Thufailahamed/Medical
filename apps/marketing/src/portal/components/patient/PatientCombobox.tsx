"use client";

// PatientCombobox — debounced typeahead patient picker used by every
// doctor "new" form on the portal (clinical note, lab order, follow-up,
// Rx, Rx template). Backed by /doctor/search-patients.
//
// Keeps its own selected-patient display so the parent can stay
// stateless and just receive `{ id, name }` via onChange.

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, User } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Avatar } from "@/portal/components/ui/Avatar";
import { useT } from "@/portal/i18n";
import { cn } from "@/portal/lib/utils";

interface PatientRow {
  patient: {
    id: string;
    nic?: string | null;
    dob?: string | null;
    sex?: string | null;
    photo?: string | null;
  };
  user: { id: string; name: string; phone?: string | null; email?: string | null };
}

export interface PatientComboboxProps {
  /** Currently selected patient (controlled). */
  value?: { id: string; name: string } | null;
  /** Called when the user picks a patient. */
  onChange: (v: { id: string; name: string } | null) => void;
  /** API endpoint — defaults to `/doctor/search-patients`. */
  endpoint?: string;
  /** Extra classes for the outer wrapper. */
  className?: string;
  /** Disabled state. */
  disabled?: boolean;
}

export function PatientCombobox({
  value,
  onChange,
  endpoint = "/doctor/search-patients",
  className,
  disabled,
}: PatientComboboxProps) {
  const t = useT();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(id);
  }, [q]);

  // Close the menu when the user clicks anywhere outside the combobox.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const search = useQuery({
    queryKey: ["doctor", "search-patients", "combobox", endpoint, debounced],
    queryFn: () =>
      api<{ patients: PatientRow[] }>(
        `${endpoint}?q=${encodeURIComponent(debounced)}&limit=8`
      ),
    enabled: debounced.length >= 2,
    staleTime: 30_000,
  });

  const candidates = useMemo(() => search.data?.patients ?? [], [search.data]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {value ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-surface">
          <Avatar name={value.name} size="xs" />
          <span className="flex-1 text-sm font-medium text-text truncate">
            {value.name}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setQ("");
              }}
              className="h-6 w-6 rounded-md flex items-center justify-center text-text-muted hover:bg-surface-2 hover:text-text transition-colors"
              aria-label={t("common.clear")}
            >
              <X size={13} />
            </button>
          )}
        </div>
      ) : (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            disabled={disabled}
            placeholder={t("patientCombobox.placeholder")}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/30 disabled:opacity-50"
          />
        </div>
      )}

      {!value && open && debounced.length < 2 && q.trim().length > 0 && (
        <div className="absolute z-30 mt-1 left-0 right-0 rounded-lg border border-border bg-surface shadow-lg p-3 text-xs text-text-muted">
          {t("patientCombobox.minChars")}
        </div>
      )}

      {!value && open && debounced.length >= 2 && (
        <div className="absolute z-30 mt-1 left-0 right-0 max-h-72 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
          {search.isFetching && candidates.length === 0 ? (
            <div className="p-3 text-xs text-text-muted">
              {t("common.loading")}
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-3 text-xs text-text-muted">
              {t("patientCombobox.noMatches")}
            </div>
          ) : (
            <ul role="listbox">
              {candidates.map((row) => (
                <li key={row.patient.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({
                        id: row.patient.id,
                        name: row.user.name,
                      });
                      setQ("");
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                  >
                    <Avatar
                      name={row.user.name}
                      size="xs"
                      src={row.patient.photo ?? undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {row.user.name}
                      </div>
                      <div className="text-[11px] text-text-muted truncate flex items-center gap-1">
                        {row.patient.nic ? (
                          <>
                            <User size={10} />
                            {row.patient.nic}
                          </>
                        ) : row.user.phone ? (
                          row.user.phone
                        ) : row.user.email ? (
                          row.user.email
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}