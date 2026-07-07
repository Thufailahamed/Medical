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
      <div className="portal-input-search-wrap">
        <Search size={14} className="portal-input-search-icon" />
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
            "portal-input portal-input-icon-left",
            value && "portal-input-clearable"
          )}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQ("");
            }}
            className="portal-input-clear-btn"
            aria-label="Clear"
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {open && q && !value ? (
        <div className="portal-autocomplete-menu">
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
                    className="portal-autocomplete-item flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-text truncate">
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
                      <span className="text-[10px] font-semibold text-amber-600 shrink-0">
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
