"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";

export interface MasterMedicine {
  id: string;
  rxcui?: string | null;
  genericName: string;
  brandName?: string | null;
  strength?: string | null;
  scheduleClass?: string | null;
  isGeneric?: boolean | null;
}

interface MasterSearchResponse {
  results: MasterMedicine[];
  count: number;
}

interface Props {
  value: MasterMedicine | null;
  onChange: (m: MasterMedicine | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function MedicineAutocomplete({ value, onChange, placeholder, disabled }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["medicines-master", "search", q],
    queryFn: () =>
      api<MasterSearchResponse>(
        `/medicines-master/search?q=${encodeURIComponent(q)}&limit=8`
      ),
    enabled: q.length >= 1,
    staleTime: 60_000,
  });

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={value ? displayName(value) : q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => {
            if (!value) setOpen(true);
          }}
          placeholder={placeholder ?? "Search medicine…"}
          disabled={disabled}
          className={cn(
            "w-full h-8 pl-7 pr-7 rounded-md border border-border bg-surface text-xs text-text",
            "placeholder:text-text-muted focus-ring focus:border-brand"
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            <X size={12} />
          </button>
        ) : null}
      </div>

      {open && q && !value ? (
        <div className="absolute z-30 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-border bg-surface shadow-[var(--shadow-md)]">
          {isFetching ? (
            <div className="px-3 py-2 text-xs text-text-muted">Searching…</div>
          ) : (data?.results ?? []).length === 0 ? (
            <div className="px-3 py-2 text-xs text-text-muted">No matches</div>
          ) : (
            <ul>
              {(data?.results ?? []).map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(m);
                      setOpen(false);
                      setQ("");
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-surface-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text truncate">
                        {m.genericName}
                      </div>
                      {m.brandName ? (
                        <div className="text-[10px] text-text-muted truncate">
                          {m.brandName}
                          {m.strength ? ` · ${m.strength}` : ""}
                        </div>
                      ) : null}
                    </div>
                    {m.scheduleClass ? (
                      <span className="text-[10px] text-warn shrink-0">
                        {m.scheduleClass}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

function displayName(m: MasterMedicine) {
  return m.brandName ? `${m.brandName} (${m.genericName})` : m.genericName;
}