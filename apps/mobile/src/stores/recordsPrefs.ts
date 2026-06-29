import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "./secureStorage";

// ─── Saved filter shape ───────────────────────────────────
export type SavedFilter = {
  id: string;
  name: string;
  createdAt: string;
  query?: string;
  type?: string;
  range?: "all" | "30d" | "1y";
  sort?: "newest" | "oldest" | "relevance";
  tags?: string[];
  scope?: "own" | "family";
  familyMemberId?: string | null;
  archivedOnly?: boolean;
};

const MAX_SAVED_FILTERS = 50;
const MAX_RECENT_SEARCHES = 10;

type RecordsPrefsState = {
  savedFilters: SavedFilter[];
  recentSearches: string[];
  familyScope: "own" | "all";
  saveFilter: (
    name: string,
    payload: Omit<SavedFilter, "id" | "createdAt" | "name">
  ) => SavedFilter;
  removeFilter: (id: string) => void;
  rememberSearch: (q: string) => void;
  setFamilyScope: (s: "own" | "all") => void;
};

export const useRecordsPrefsStore = create<RecordsPrefsState>()(
  persist(
    (set, get) => ({
      savedFilters: [],
      recentSearches: [],
      familyScope: "all",
      saveFilter: (name, payload) => {
        const f: SavedFilter = {
          id: crypto.randomUUID(),
          name: name.trim() || "Untitled filter",
          createdAt: new Date().toISOString(),
          ...payload,
        };
        set({
          savedFilters: [f, ...get().savedFilters].slice(0, MAX_SAVED_FILTERS),
        });
        return f;
      },
      removeFilter: (id) =>
        set({ savedFilters: get().savedFilters.filter((f) => f.id !== id) }),
      rememberSearch: (q) => {
        const t = q.trim();
        if (!t) return;
        const cur = get().recentSearches.filter(
          (s) => s.toLowerCase() !== t.toLowerCase()
        );
        set({ recentSearches: [t, ...cur].slice(0, MAX_RECENT_SEARCHES) });
      },
      setFamilyScope: (s) => set({ familyScope: s }),
    }),
    {
      name: "healthcare-records-prefs",
      storage: createJSONStorage(() => secureStorage),
      version: 1,
    }
  )
);