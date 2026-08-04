// Standardized Medical Coding Dictionaries & Mappings (LOINC & RxNorm).
// Auto-maps extracted lab test names and prescription drug names to global
// medical taxonomy codes for unified querying, analytics, and CDS.

// Common LOINC mappings (Logical Observation Identifiers Names and Codes)
export const LOINC_DICTIONARY: Record<string, { code: string; name: string; unit?: string }> = {
  // Blood / CBC
  "hemoglobin": { code: "718-7", name: "Hemoglobin [Mass/volume] in Blood", unit: "g/dL" },
  "hba1c": { code: "4548-4", name: "Hemoglobin A1c/Hemoglobin.total in Blood", unit: "%" },
  "glycated hemoglobin": { code: "4548-4", name: "Hemoglobin A1c/Hemoglobin.total in Blood", unit: "%" },
  "wbc": { code: "6690-2", name: "Leukocytes [#/volume] in Blood", unit: "10*3/uL" },
  "white blood cell count": { code: "6690-2", name: "Leukocytes [#/volume] in Blood", unit: "10*3/uL" },
  "rbc": { code: "789-8", name: "Erythrocytes [#/volume] in Blood", unit: "10*6/uL" },
  "platelets": { code: "777-3", name: "Platelets [#/volume] in Blood", unit: "10*3/uL" },
  "hematocrit": { code: "4544-3", name: "Hematocrit [Volume Fraction] of Blood", unit: "%" },

  // Lipid Panel
  "ldl": { code: "13457-7", name: "Cholesterol in LDL [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "ldl cholesterol": { code: "13457-7", name: "Cholesterol in LDL [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "hdl": { code: "2085-9", name: "Cholesterol in HDL [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "hdl cholesterol": { code: "2085-9", name: "Cholesterol in HDL [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "triglycerides": { code: "2571-8", name: "Triglyceride [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "total cholesterol": { code: "2093-3", name: "Cholesterol [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "cholesterol": { code: "2093-3", name: "Cholesterol [Mass/volume] in Serum or Plasma", unit: "mg/dL" },

  // Metabolic & Renal
  "glucose": { code: "2345-7", name: "Glucose [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "fasting blood sugar": { code: "1558-6", name: "Fasting glucose [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "fbs": { code: "1558-6", name: "Fasting glucose [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "creatinine": { code: "2160-0", name: "Creatinine [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "blood urea nitrogen": { code: "3094-0", name: "Urea nitrogen [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "bun": { code: "3094-0", name: "Urea nitrogen [Mass/volume] in Serum or Plasma", unit: "mg/dL" },
  "uric acid": { code: "3084-1", name: "Urate [Mass/volume] in Serum or Plasma", unit: "mg/dL" },

  // Liver Function
  "sgot": { code: "1920-8", name: "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma", unit: "U/L" },
  "ast": { code: "1920-8", name: "Aspartate aminotransferase [Enzymatic activity/volume] in Serum or Plasma", unit: "U/L" },
  "sgpt": { code: "1742-6", name: "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma", unit: "U/L" },
  "alt": { code: "1742-6", name: "Alanine aminotransferase [Enzymatic activity/volume] in Serum or Plasma", unit: "U/L" },
  "bilirubin": { code: "1975-2", name: "Bilirubin.total [Mass/volume] in Serum or Plasma", unit: "mg/dL" },

  // Endocrine & Thyroid
  "tsh": { code: "3016-3", name: "Thyrotropin [Units/volume] in Serum or Plasma", unit: "uIU/mL" },
  "thyroid stimulating hormone": { code: "3016-3", name: "Thyrotropin [Units/volume] in Serum or Plasma", unit: "uIU/mL" },
  "free t4": { code: "3024-7", name: "Thyroxine (T4) free [Mass/volume] in Serum or Plasma", unit: "ng/dL" },
  "vitamin d": { code: "62292-8", name: "25-hydroxyvitamin D3 [Mass/volume] in Serum or Plasma", unit: "ng/mL" },
};

// Common RxNorm mappings (RxNorm Concept Unique Identifier - RxCUI)
export const RXNORM_DICTIONARY: Record<string, { code: string; concept: string; category?: string }> = {
  "amoxicillin": { code: "723", concept: "Amoxicillin", category: "Antibiotic" },
  "amoxil": { code: "723", concept: "Amoxicillin", category: "Antibiotic" },
  "augmentin": { code: "215444", concept: "Amoxicillin / Clavulanate", category: "Antibiotic" },
  "penicillin": { code: "7980", concept: "Penicillin", category: "Antibiotic" },
  "azithromycin": { code: "18631", concept: "Azithromycin", category: "Antibiotic" },
  "ciprofloxacin": { code: "2551", concept: "Ciprofloxacin", category: "Antibiotic" },
  "metformin": { code: "6809", concept: "Metformin", category: "Antidiabetic" },
  "glucophage": { code: "6809", concept: "Metformin", category: "Antidiabetic" },
  "atorvastatin": { code: "83367", concept: "Atorvastatin", category: "Statin" },
  "lipitor": { code: "83367", concept: "Atorvastatin", category: "Statin" },
  "paracetamol": { code: "161", concept: "Acetaminophen", category: "Analgesic" },
  "acetaminophen": { code: "161", concept: "Acetaminophen", category: "Analgesic" },
  "panadol": { code: "161", concept: "Acetaminophen", category: "Analgesic" },
  "aspirin": { code: "1191", concept: "Aspirin", category: "NSAID / Antiplatelet" },
  "ibuprofen": { code: "5640", concept: "Ibuprofen", category: "NSAID" },
  "nurofen": { code: "5640", concept: "Ibuprofen", category: "NSAID" },
  "omeprazole": { code: "7646", concept: "Omeprazole", category: "Proton Pump Inhibitor" },
  "losartan": { code: "5224", concept: "Losartan", category: "Antihypertensive" },
  "amlodipine": { code: "17767", concept: "Amlodipine", category: "Antihypertensive" },
};

/** Look up LOINC code and metadata by test name. Returns null if not found. */
export function lookupLoinc(testName: string): { code: string; name: string; unit?: string } | null {
  if (!testName) return null;
  const key = testName.trim().toLowerCase();
  return LOINC_DICTIONARY[key] ?? null;
}

/** Look up RxNorm code and metadata by drug name. Returns null if not found. */
export function lookupRxNorm(drugName: string): { code: string; concept: string; category?: string } | null {
  if (!drugName) return null;
  const key = drugName.trim().toLowerCase();
  return RXNORM_DICTIONARY[key] ?? null;
}
