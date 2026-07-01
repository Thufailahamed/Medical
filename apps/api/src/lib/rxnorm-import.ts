// E-Rx Phase 1: RxNorm import wrapper.
// Free public API (https://rxnav.nlm.nih.gov/REST/) — no auth.
// Used as an enrichment step in the seed script when adding a medicine
// the curated list doesn't cover. The primary seeding path uses
// `scripts/seed-rxcui-list.ts` so the system works offline; this
// wrapper is the escape hatch for ad-hoc imports.
//
// Endpoints used (all GET, JSON):
//   /REST/rxcui/{rxcui}/properties
//   /REST/rxcui/{rxcui}/related?tty=SCD+SBD          (brand names)
//   /REST/rxcui/{rxcui}/ingredient
//   /REST/approximateTerm.json?term=<name>&maxEntries=5

const RXNORM_BASE = "https://rxnav.nlm.nih.gov/REST";

export type RxNormProperties = {
  rxcui: string;
  name: string;
  tty: string;
  language: string;
  suppress: string;
  umlscui?: string;
};

export type RxNormRelatedConcept = {
  rxcui: string;
  name: string;
  tty: string;
};

export type RxNormIngredient = {
  rxcui: string;
  name: string;
  tty: string;
};

async function rateLimited<T>(p: Promise<T>, delayMs = 100): Promise<T> {
  const out = await p;
  await new Promise((r) => setTimeout(r, delayMs));
  return out;
}

export async function fetchRxNormProperties(
  rxcui: string
): Promise<RxNormProperties | null> {
  try {
    const res = await rateLimited(
      fetch(`${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`, {
        headers: { Accept: "application/json" },
      })
    );
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.properties?.name ? json.properties : null;
  } catch {
    return null;
  }
}

export async function fetchRelatedBrandNames(
  rxcui: string
): Promise<string[]> {
  try {
    const res = await rateLimited(
      fetch(
        `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/related.json?tty=SBD+SBDF`,
        { headers: { Accept: "application/json" } }
      )
    );
    if (!res.ok) return [];
    const json: any = await res.json();
    const group = json?.relatedGroup?.conceptGroup ?? [];
    const names: string[] = [];
    for (const g of group) {
      for (const c of g.conceptProperties ?? []) {
        if (c.name) names.push(String(c.name));
      }
    }
    return names;
  } catch {
    return [];
  }
}

export async function fetchIngredients(
  rxcui: string
): Promise<RxNormIngredient[]> {
  try {
    const res = await rateLimited(
      fetch(
        `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/ingredient.json`,
        { headers: { Accept: "application/json" } }
      )
    );
    if (!res.ok) return [];
    const json: any = await res.json();
    const group = json?.ingredientGroup?.ingredient ?? [];
    if (!Array.isArray(group)) return [];
    return group.filter((x: any) => x?.rxcui).map((x: any) => ({
      rxcui: String(x.rxcui),
      name: String(x.name ?? ""),
      tty: String(x.tty ?? "IN"),
    }));
  } catch {
    return [];
  }
}

export async function approximateSearch(
  term: string,
  maxEntries = 5
): Promise<Array<{ rxcui: string; name: string; score?: number }>> {
  try {
    const res = await rateLimited(
      fetch(
        `${RXNORM_BASE}/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=${maxEntries}`,
        { headers: { Accept: "application/json" } }
      )
    );
    if (!res.ok) return [];
    const json: any = await res.json();
    const candidates = json?.approximateGroup?.candidate ?? [];
    if (!Array.isArray(candidates)) return [];
    return candidates.map((c: any) => ({
      rxcui: String(c.rxcui ?? ""),
      name: String(c.name ?? ""),
      score: typeof c.score === "number" ? c.score : undefined,
    }));
  } catch {
    return [];
  }
}
