export interface ClinicalNoteRecord {
  id: string;
  patientId: string;
  title: string | null;
  diagnosis: string | null;
  notes: string | null;
  date: string | null;
  createdAt: string;
  patient?: { id: string; name: string } | null;
}

export interface SoapSections {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  raw?: string;
}

/** Parse SOAP note body saved as `S: …\n\nO: …` blocks. */
export function parseSoapNotes(notes: string | null | undefined): SoapSections {
  if (!notes?.trim()) return {};

  const sections: SoapSections = {};
  const blocks = notes.split(/\n\n+/);

  for (const block of blocks) {
    const match = block.match(/^([SOAP]):\s*([\s\S]*)$/i);
    if (!match) continue;
    const key = match[1].toUpperCase();
    const value = match[2].trim();
    if (!value) continue;
    if (key === "S") sections.subjective = value;
    if (key === "O") sections.objective = value;
    if (key === "A") sections.assessment = value;
    if (key === "P") sections.plan = value;
  }

  if (!sections.subjective && !sections.objective && !sections.assessment && !sections.plan) {
    sections.raw = notes.trim();
  }

  return sections;
}
