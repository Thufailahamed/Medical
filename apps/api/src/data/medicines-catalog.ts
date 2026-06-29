// Curated medicine catalog for the /medicines/suggest endpoint.
// Names use British/generic spellings; Sri Lanka + South Asia common stock.

export type MedicineCatalogEntry = {
  name: string;
  category: string;
  commonDosages: string[];
  commonFrequencies: string[];
  commonTimings?: string[];
  aliases?: string[];
};

export const MEDICINE_CATALOG: MedicineCatalogEntry[] = [
  // Analgesics / antipyretics
  { name: "Paracetamol", category: "Analgesic", commonDosages: ["500 mg", "650 mg", "1 g"], commonFrequencies: ["As needed", "Four times daily"], commonTimings: ["After food", "Any time"], aliases: ["Acetaminophen", "Panadol", "Tylenol"] },
  { name: "Ibuprofen", category: "NSAID", commonDosages: ["200 mg", "400 mg", "600 mg"], commonFrequencies: ["As needed", "Twice daily", "Three times daily"], commonTimings: ["After food"], aliases: ["Brufen", "Advil"] },
  { name: "Aspirin", category: "NSAID / Antiplatelet", commonDosages: ["75 mg", "150 mg", "300 mg"], commonFrequencies: ["Once daily"], commonTimings: ["After food", "Any time"], aliases: ["Disprin", "Ecosprin"] },
  { name: "Diclofenac", category: "NSAID", commonDosages: ["25 mg", "50 mg", "75 mg"], commonFrequencies: ["Twice daily", "Three times daily"], commonTimings: ["After food"], aliases: ["Voveran", "Voltaren"] },
  { name: "Naproxen", category: "NSAID", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["After food"] },
  { name: "Celecoxib", category: "NSAID", commonDosages: ["100 mg", "200 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["After food"], aliases: ["Celebrex"] },
  { name: "Tramadol", category: "Analgesic", commonDosages: ["50 mg", "100 mg"], commonFrequencies: ["As needed", "Twice daily"], commonTimings: ["Any time"] },
  { name: "Paracetamol + Tramadol", category: "Analgesic combo", commonDosages: ["325/37.5 mg"], commonFrequencies: ["As needed", "Twice daily"], commonTimings: ["Any time"] },

  // Antibiotics
  { name: "Amoxicillin", category: "Antibiotic", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Three times daily"], commonTimings: ["After food"], aliases: ["Mox", "Augmentin"] },
  { name: "Amoxicillin + Clavulanate", category: "Antibiotic", commonDosages: ["375 mg", "625 mg", "1 g"], commonFrequencies: ["Twice daily", "Three times daily"], commonTimings: ["After food", "With food"], aliases: ["Augmentin", "Co-amoxiclav"] },
  { name: "Azithromycin", category: "Antibiotic", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Ciprofloxacin", category: "Antibiotic", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["Any time"] },
  { name: "Doxycycline", category: "Antibiotic", commonDosages: ["100 mg"], commonFrequencies: ["Twice daily", "Once daily"], commonTimings: ["After food"] },
  { name: "Cefuroxime", category: "Antibiotic", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["After food"], aliases: ["Zinnat"] },
  { name: "Cefixime", category: "Antibiotic", commonDosages: ["200 mg", "400 mg"], commonFrequencies: ["Twice daily", "Once daily"], commonTimings: ["Any time"] },
  { name: "Metronidazole", category: "Antibiotic", commonDosages: ["400 mg", "500 mg"], commonFrequencies: ["Three times daily"], commonTimings: ["After food"], aliases: ["Flagyl"] },
  { name: "Levofloxacin", category: "Antibiotic", commonDosages: ["250 mg", "500 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Nitrofurantoin", category: "Antibiotic", commonDosages: ["50 mg", "100 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["With food", "After food"] },

  // Antidiabetics
  { name: "Metformin", category: "Antidiabetic", commonDosages: ["500 mg", "850 mg", "1 g"], commonFrequencies: ["Twice daily", "Three times daily"], commonTimings: ["After food", "With food"] },
  { name: "Glimepiride", category: "Antidiabetic", commonDosages: ["1 mg", "2 mg", "4 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Before food", "Morning"], aliases: ["Amaryl"] },
  { name: "Gliclazide", category: "Antidiabetic", commonDosages: ["40 mg", "80 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["Before food", "Morning"] },
  { name: "Sitagliptin", category: "Antidiabetic", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"], aliases: ["Januvia"] },
  { name: "Insulin (Regular)", category: "Antidiabetic", commonDosages: ["10 IU"], commonFrequencies: ["Three times daily"], commonTimings: ["Before food"] },
  { name: "Insulin (Glargine)", category: "Antidiabetic", commonDosages: ["10 IU", "100 IU/ml"], commonFrequencies: ["Once daily"], commonTimings: ["Night", "Any time"], aliases: ["Lantus", "Basaglar"] },

  // Cardiovascular
  { name: "Amlodipine", category: "Antihypertensive", commonDosages: ["5 mg", "10 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time", "Morning"] },
  { name: "Telmisartan", category: "Antihypertensive", commonDosages: ["40 mg", "80 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Losartan", category: "Antihypertensive", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Enalapril", category: "Antihypertensive", commonDosages: ["5 mg", "10 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["Any time"] },
  { name: "Atenolol", category: "Beta blocker", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning"] },
  { name: "Metoprolol", category: "Beta blocker", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["Morning", "Any time"] },
  { name: "Propranolol", category: "Beta blocker", commonDosages: ["10 mg", "20 mg", "40 mg"], commonFrequencies: ["Twice daily", "Three times daily"], commonTimings: ["Before food", "After food"] },
  { name: "Carvedilol", category: "Beta blocker", commonDosages: ["3.125 mg", "6.25 mg", "12.5 mg", "25 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["With food", "After food"] },
  { name: "Hydrochlorothiazide", category: "Diuretic", commonDosages: ["12.5 mg", "25 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning"] },
  { name: "Furosemide", category: "Diuretic", commonDosages: ["20 mg", "40 mg", "80 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["Morning"], aliases: ["Lasix"] },
  { name: "Spironolactone", category: "Diuretic", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning"] },
  { name: "Atorvastatin", category: "Statin", commonDosages: ["10 mg", "20 mg", "40 mg", "80 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night"] },
  { name: "Rosuvastatin", category: "Statin", commonDosages: ["5 mg", "10 mg", "20 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night"] },
  { name: "Simvastatin", category: "Statin", commonDosages: ["10 mg", "20 mg", "40 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night"] },
  { name: "Clopidogrel", category: "Antiplatelet", commonDosages: ["75 mg", "150 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Warfarin", category: "Anticoagulant", commonDosages: ["1 mg", "2 mg", "5 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Evening", "Night"] },
  { name: "Apixaban", category: "Anticoagulant", commonDosages: ["2.5 mg", "5 mg"], commonFrequencies: ["Twice daily"], commonTimings: ["Any time"] },

  // GI
  { name: "Omeprazole", category: "PPI", commonDosages: ["20 mg", "40 mg"], commonFrequencies: ["Once daily", "Twice daily"], commonTimings: ["Before food", "Morning"] },
  { name: "Pantoprazole", category: "PPI", commonDosages: ["20 mg", "40 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Before food", "Morning"] },
  { name: "Esomeprazole", category: "PPI", commonDosages: ["20 mg", "40 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Before food", "Morning"] },
  { name: "Ranitidine", category: "H2 blocker", commonDosages: ["150 mg", "300 mg"], commonFrequencies: ["Twice daily", "Once daily"], commonTimings: ["Before food", "Night"] },
  { name: "Domperidone", category: "Antiemetic", commonDosages: ["10 mg"], commonFrequencies: ["Three times daily", "As needed"], commonTimings: ["Before food"] },
  { name: "Ondansetron", category: "Antiemetic", commonDosages: ["4 mg", "8 mg"], commonFrequencies: ["As needed", "Twice daily"], commonTimings: ["Any time"] },
  { name: "Loperamide", category: "Antidiarrhoeal", commonDosages: ["2 mg"], commonFrequencies: ["As needed"], commonTimings: ["Any time"] },
  { name: "ORS", category: "Rehydration", commonDosages: ["1 sachet"], commonFrequencies: ["As needed"], commonTimings: ["Any time"] },

  // Respiratory / allergy
  { name: "Salbutamol", category: "Bronchodilator", commonDosages: ["100 mcg", "200 mcg"], commonFrequencies: ["As needed", "Three times daily"], commonTimings: ["Any time"], aliases: ["Ventolin"] },
  { name: "Budesonide + Formoterol", category: "Inhaler", commonDosages: ["100/6 mcg", "200/6 mcg"], commonFrequencies: ["Twice daily"], commonTimings: ["Morning", "Evening"], aliases: ["Symbicort", "Foracort"] },
  { name: "Montelukast", category: "Leukotriene", commonDosages: ["4 mg", "5 mg", "10 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night"] },
  { name: "Cetirizine", category: "Antihistamine", commonDosages: ["5 mg", "10 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night", "Any time"] },
  { name: "Loratadine", category: "Antihistamine", commonDosages: ["10 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Fexofenadine", category: "Antihistamine", commonDosages: ["120 mg", "180 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Levocetirizine", category: "Antihistamine", commonDosages: ["5 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Night", "Any time"] },

  // Thyroid / endocrine
  { name: "Levothyroxine", category: "Thyroid", commonDosages: ["25 mcg", "50 mcg", "75 mcg", "100 mcg", "125 mcg"], commonFrequencies: ["Once daily"], commonTimings: ["Before food", "Morning"], aliases: ["Eltroxin", "Thyronorm"] },

  // Vitamins / supplements
  { name: "Vitamin D3", category: "Supplement", commonDosages: ["1000 IU", "2000 IU", "60000 IU"], commonFrequencies: ["Once daily", "Once weekly"], commonTimings: ["After food", "With food"], aliases: ["Cholecalciferol"] },
  { name: "Vitamin B12", category: "Supplement", commonDosages: ["500 mcg", "1000 mcg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Iron + Folic Acid", category: "Supplement", commonDosages: ["100 mg + 0.5 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Before food", "Any time"] },
  { name: "Ferrous Sulphate", category: "Supplement", commonDosages: ["200 mg"], commonFrequencies: ["Twice daily", "Three times daily"], commonTimings: ["Before food"] },
  { name: "Folic Acid", category: "Supplement", commonDosages: ["0.5 mg", "1 mg", "5 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Calcium + Vitamin D", category: "Supplement", commonDosages: ["500 mg + 250 IU"], commonFrequencies: ["Twice daily"], commonTimings: ["After food", "With food"] },
  { name: "Multivitamin", category: "Supplement", commonDosages: ["1 tablet"], commonFrequencies: ["Once daily"], commonTimings: ["After food"] },

  // CNS / mental health
  { name: "Sertraline", category: "Antidepressant", commonDosages: ["25 mg", "50 mg", "100 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning", "Any time"] },
  { name: "Fluoxetine", category: "Antidepressant", commonDosages: ["10 mg", "20 mg", "40 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning", "Any time"] },
  { name: "Escitalopram", category: "Antidepressant", commonDosages: ["5 mg", "10 mg", "20 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Morning", "Any time"] },
  { name: "Diazepam", category: "Anxiolytic", commonDosages: ["2 mg", "5 mg", "10 mg"], commonFrequencies: ["As needed", "Twice daily"], commonTimings: ["Any time"] },
  { name: "Alprazolam", category: "Anxiolytic", commonDosages: ["0.25 mg", "0.5 mg", "1 mg"], commonFrequencies: ["As needed", "Three times daily"], commonTimings: ["Any time"] },

  // Misc
  { name: "Methotrexate", category: "DMARD", commonDosages: ["2.5 mg", "5 mg", "7.5 mg", "15 mg"], commonFrequencies: ["Once weekly"], commonTimings: ["Any time"] },
  { name: "Allopurinol", category: "Uric acid", commonDosages: ["100 mg", "300 mg"], commonFrequencies: ["Once daily"], commonTimings: ["After food"] },
  { name: "Febuxostat", category: "Uric acid", commonDosages: ["40 mg", "80 mg"], commonFrequencies: ["Once daily"], commonTimings: ["Any time"] },
  { name: "Levetiracetam", category: "Anticonvulsant", commonDosages: ["250 mg", "500 mg", "1 g"], commonFrequencies: ["Twice daily"], commonTimings: ["Any time"] },
  { name: "Prednisolone", category: "Corticosteroid", commonDosages: ["5 mg", "10 mg", "20 mg", "40 mg"], commonFrequencies: ["Once daily"], commonTimings: ["After food", "Morning"] },
];

// Build a flat lookup index by name + alias (lower-cased) for O(1) retrieval.
const _index = new Map<string, number>();
MEDICINE_CATALOG.forEach((e, i) => {
  _index.set(e.name.toLowerCase(), i);
  for (const a of e.aliases || []) _index.set(a.toLowerCase(), i);
});

export function findCatalogEntry(query: string): MedicineCatalogEntry | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const idx = _index.get(q);
  return idx === undefined ? null : MEDICINE_CATALOG[idx];
}
