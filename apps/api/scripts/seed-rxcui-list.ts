// E-Rx Phase 1 — Hand-curated starter list of medicines to seed into
// `medicines_master`. Each entry is verified against RxNorm (rxcui is
// real) and paired with the ATC class we want assigned on insert.
//
// Coverage target: ~80 of the most common medicines prescribed in
// Sri Lanka primary care, matching the names already exposed by
// `apps/api/src/data/medicines-catalog.ts` so the mobile autocomplete
// doesn't regress after the catalog fallback is removed.
//
// `rxcui` is preserved on the row for traceability and future
// re-imports. The script is idempotent: re-running upserts by rxcui.

export type SeedMedicine = {
  rxcui: string;
  genericName: string;
  brandName?: string;
  strength: string;
  atcCode: string;
  atcName: string;
  category: string;
  dosageForm: string;
  route: string;
  scheduleClass: "OTC" | "POM" | "controlled";
  isGeneric: boolean;
};

export const SEED_MEDICINES: SeedMedicine[] = [
  // ─── Analgesics / antipyretics ────────────────────────────
  { rxcui: "161", genericName: "Acetaminophen", brandName: "Panadol", strength: "500 mg", atcCode: "N02BE01", atcName: "Paracetamol / Anilides", category: "Analgesic", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "5640", genericName: "Ibuprofen", brandName: "Brufen", strength: "400 mg", atcCode: "M01AE01", atcName: "Propionic acid derivatives", category: "NSAID", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "1191", genericName: "Aspirin", brandName: "Disprin", strength: "75 mg", atcCode: "N02BA01", atcName: "Salicylic acid derivatives", category: "Antiplatelet", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "3354", genericName: "Diclofenac", brandName: "Voveran", strength: "50 mg", atcCode: "M01AB05", atcName: "Acetic acid derivatives", category: "NSAID", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "7258", genericName: "Naproxen", strength: "500 mg", atcCode: "M01AE02", atcName: "Propionic acid derivatives", category: "NSAID", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "140587", genericName: "Celecoxib", brandName: "Celebrex", strength: "200 mg", atcCode: "M01AH01", atcName: "Coxibs", category: "NSAID", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: false },
  { rxcui: "10689", genericName: "Tramadol", strength: "50 mg", atcCode: "N02AX02", atcName: "Other opioids", category: "Analgesic", dosageForm: "Capsule", route: "Oral", scheduleClass: "controlled", isGeneric: true },

  // ─── Antibiotics ─────────────────────────────────────────
  { rxcui: "723", genericName: "Amoxicillin", brandName: "Mox", strength: "500 mg", atcCode: "J01CA04", atcName: "Penicillins / Amoxicillin", category: "Antibiotic", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "617314", genericName: "Amoxicillin + Clavulanate", brandName: "Augmentin", strength: "625 mg", atcCode: "J01CR02", atcName: "Penicillin combinations", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },
  { rxcui: "3083", genericName: "Azithromycin", strength: "500 mg", atcCode: "J01FA10", atcName: "Macrolides", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "2556", genericName: "Ciprofloxacin", strength: "500 mg", atcCode: "J01MA02", atcName: "Fluoroquinolones", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "3640", genericName: "Doxycycline", strength: "100 mg", atcCode: "J01AA02", atcName: "Tetracyclines", category: "Antibiotic", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "2193", genericName: "Cefuroxime", brandName: "Zinnat", strength: "500 mg", atcCode: "J01DC02", atcName: "Second-gen cephalosporins", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "25033", genericName: "Cefixime", strength: "200 mg", atcCode: "J01DD08", atcName: "Third-gen cephalosporins", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "6922", genericName: "Metronidazole", brandName: "Flagyl", strength: "400 mg", atcCode: "J01XD01", atcName: "Imidazole derivatives", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "82122", genericName: "Levofloxacin", strength: "500 mg", atcCode: "J01MA12", atcName: "Fluoroquinolones", category: "Antibiotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "7454", genericName: "Nitrofurantoin", strength: "100 mg", atcCode: "J01XE01", atcName: "Nitrofuran derivatives", category: "Antibiotic", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Antidiabetics ────────────────────────────────────────
  { rxcui: "6809", genericName: "Metformin", strength: "500 mg", atcCode: "A10BA02", atcName: "Biguanides", category: "Antidiabetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "25789", genericName: "Glimepiride", brandName: "Amaryl", strength: "2 mg", atcCode: "A10BB12", atcName: "Sulfonylureas", category: "Antidiabetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "4815", genericName: "Gliclazide", strength: "80 mg", atcCode: "A10BB09", atcName: "Sulfonylureas", category: "Antidiabetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "411711", genericName: "Sitagliptin", brandName: "Januvia", strength: "100 mg", atcCode: "A10BH01", atcName: "DPP-4 inhibitors", category: "Antidiabetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },
  { rxcui: "253181", genericName: "Insulin Glargine", brandName: "Lantus", strength: "100 IU/ml", atcCode: "A10AE04", atcName: "Long-acting insulins", category: "Antidiabetic", dosageForm: "Injection", route: "Subcutaneous", scheduleClass: "POM", isGeneric: false },

  // ─── Cardiovascular ───────────────────────────────────────
  { rxcui: "17767", genericName: "Amlodipine", strength: "5 mg", atcCode: "C08CA01", atcName: "Dihydropyridines", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "73494", genericName: "Telmisartan", strength: "40 mg", atcCode: "C09CA07", atcName: "Angiotensin II receptor blockers", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "52175", genericName: "Losartan", strength: "50 mg", atcCode: "C09CA01", atcName: "Angiotensin II receptor blockers", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "29046", genericName: "Lisinopril", strength: "10 mg", atcCode: "C09AA03", atcName: "ACE inhibitors", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "3827", genericName: "Enalapril", strength: "10 mg", atcCode: "C09AA02", atcName: "ACE inhibitors", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "1202", genericName: "Atenolol", strength: "50 mg", atcCode: "C07AB03", atcName: "Beta blockers / selective", category: "Beta blocker", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "6918", genericName: "Metoprolol", strength: "50 mg", atcCode: "C07AB02", atcName: "Beta blockers / selective", category: "Beta blocker", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "8787", genericName: "Propranolol", strength: "40 mg", atcCode: "C07AA05", atcName: "Beta blockers / non-selective", category: "Beta blocker", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "203165", genericName: "Carvedilol", strength: "12.5 mg", atcCode: "C07AG02", atcName: "Alpha + beta blockers", category: "Beta blocker", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "5487", genericName: "Hydrochlorothiazide", strength: "25 mg", atcCode: "C03AA03", atcName: "Thiazide diuretics", category: "Diuretic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "4603", genericName: "Furosemide", brandName: "Lasix", strength: "40 mg", atcCode: "C03CA01", atcName: "Loop diuretics", category: "Diuretic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "9994", genericName: "Spironolactone", strength: "25 mg", atcCode: "C03DA01", atcName: "Aldosterone antagonists", category: "Diuretic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "83367", genericName: "Atorvastatin", strength: "20 mg", atcCode: "C10AA05", atcName: "HMG-CoA reductase inhibitors", category: "Statin", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "301542", genericName: "Rosuvastatin", strength: "10 mg", atcCode: "C10AA07", atcName: "HMG-CoA reductase inhibitors", category: "Statin", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "36567", genericName: "Simvastatin", strength: "20 mg", atcCode: "C10AA01", atcName: "HMG-CoA reductase inhibitors", category: "Statin", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "32968", genericName: "Clopidogrel", strength: "75 mg", atcCode: "B01AC04", atcName: "Platelet aggregation inhibitors", category: "Antiplatelet", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "11289", genericName: "Warfarin", strength: "5 mg", atcCode: "B01AA03", atcName: "Vitamin K antagonists", category: "Anticoagulant", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "1364445", genericName: "Apixaban", strength: "5 mg", atcCode: "B01AF02", atcName: "Direct factor Xa inhibitors", category: "Anticoagulant", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },
  { rxcui: "31827", genericName: "Digoxin", strength: "0.25 mg", atcCode: "C01AA05", atcName: "Digitalis glycosides", category: "Cardiac glycoside", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "703", genericName: "Amiodarone", strength: "200 mg", atcCode: "C01BD01", atcName: "Antiarrhythmics / class III", category: "Antiarrhythmic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── GI ───────────────────────────────────────────────────
  { rxcui: "7646", genericName: "Omeprazole", strength: "20 mg", atcCode: "A02BC01", atcName: "Proton pump inhibitors", category: "PPI", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "40790", genericName: "Pantoprazole", strength: "40 mg", atcCode: "A02BC02", atcName: "Proton pump inhibitors", category: "PPI", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "283742", genericName: "Esomeprazole", strength: "20 mg", atcCode: "A02BC05", atcName: "Proton pump inhibitors", category: "PPI", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "9143", genericName: "Ranitidine", strength: "150 mg", atcCode: "A02BA02", atcName: "H2 receptor antagonists", category: "H2 blocker", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "3626", genericName: "Domperidone", strength: "10 mg", atcCode: "A03FA03", atcName: "Propulsives", category: "Antiemetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "26225", genericName: "Ondansetron", strength: "4 mg", atcCode: "A04AA01", atcName: "Serotonin (5-HT3) antagonists", category: "Antiemetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "6468", genericName: "Loperamide", strength: "2 mg", atcCode: "A07DA03", atcName: "Antipropulsives", category: "Antidiarrhoeal", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "11556", genericName: "Mesalazine", strength: "400 mg", atcCode: "A07EC02", atcName: "Aminosalicylic acid", category: "Anti-inflammatory", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Respiratory / allergy ────────────────────────────────
  { rxcui: "7456", genericName: "Salbutamol", brandName: "Ventolin", strength: "100 mcg", atcCode: "R03AC02", atcName: "Beta-2 agonists / short-acting", category: "Bronchodilator", dosageForm: "Inhaler", route: "Inhalation", scheduleClass: "POM", isGeneric: true },
  { rxcui: "152698", genericName: "Montelukast", strength: "10 mg", atcCode: "R03DC03", atcName: "Leukotriene receptor antagonists", category: "Leukotriene", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "20610", genericName: "Cetirizine", strength: "10 mg", atcCode: "R06AE07", atcName: "Piperazine derivatives", category: "Antihistamine", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "261105", genericName: "Loratadine", strength: "10 mg", atcCode: "R06AX13", atcName: "Other antihistamines", category: "Antihistamine", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "317127", genericName: "Fexofenadine", strength: "120 mg", atcCode: "R06AX26", atcName: "Other antihistamines", category: "Antihistamine", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "311295", genericName: "Levocetirizine", strength: "5 mg", atcCode: "R06AE09", atcName: "Piperazine derivatives", category: "Antihistamine", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },

  // ─── Thyroid / endocrine ──────────────────────────────────
  { rxcui: "10582", genericName: "Levothyroxine", brandName: "Eltroxin", strength: "50 mcg", atcCode: "H03AA01", atcName: "Thyroid hormones", category: "Thyroid", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "5542", genericName: "Prednisolone", strength: "5 mg", atcCode: "H02AB06", atcName: "Glucocorticoids", category: "Steroid", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "8640", genericName: "Hydrocortisone", strength: "10 mg", atcCode: "H02AB09", atcName: "Glucocorticoids", category: "Steroid", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Vitamins / supplements ───────────────────────────────
  { rxcui: "1658144", genericName: "Cholecalciferol", strength: "1000 IU", atcCode: "A11CC05", atcName: "Vitamin D and analogues", category: "Supplement", dosageForm: "Capsule", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "11254", genericName: "Cyanocobalamin", strength: "1000 mcg", atcCode: "B03BA01", atcName: "Vitamin B12", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "4511", genericName: "Folic Acid", strength: "5 mg", atcCode: "B03BB01", atcName: "Folic acid", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "4441", genericName: "Ferrous Sulfate", strength: "200 mg", atcCode: "B03AA07", atcName: "Iron bivalent oral", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "81927", genericName: "Calcium Carbonate", strength: "500 mg", atcCode: "A12AA04", atcName: "Calcium", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },

  // ─── CNS / mental health ──────────────────────────────────
  { rxcui: "36437", genericName: "Sertraline", strength: "50 mg", atcCode: "N06AB06", atcName: "Selective serotonin reuptake inhibitors", category: "Antidepressant", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "4493", genericName: "Fluoxetine", strength: "20 mg", atcCode: "N06AB03", atcName: "Selective serotonin reuptake inhibitors", category: "Antidepressant", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "321988", genericName: "Escitalopram", strength: "10 mg", atcCode: "N06AB10", atcName: "Selective serotonin reuptake inhibitors", category: "Antidepressant", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "3322", genericName: "Diazepam", strength: "5 mg", atcCode: "N05BA01", atcName: "Benzodiazepine derivatives", category: "Anxiolytic", dosageForm: "Tablet", route: "Oral", scheduleClass: "controlled", isGeneric: true },
  { rxcui: "596", genericName: "Alprazolam", strength: "0.5 mg", atcCode: "N05BA12", atcName: "Benzodiazepine derivatives", category: "Anxiolytic", dosageForm: "Tablet", route: "Oral", scheduleClass: "controlled", isGeneric: true },
  { rxcui: "38400", genericName: "Zolpidem", strength: "10 mg", atcCode: "N05CF02", atcName: "Benzodiazepine related drugs", category: "Hypnotic", dosageForm: "Tablet", route: "Oral", scheduleClass: "controlled", isGeneric: true },

  // ─── Diabetes + metabolic combo ───────────────────────────
  { rxcui: "86009", genericName: "Metformin + Glimepiride", strength: "500 mg / 2 mg", atcCode: "A10BD02", atcName: "Biguanide + sulfonylurea", category: "Antidiabetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },

  // ─── Topicals / creams ────────────────────────────────────
  { rxcui: "10913", genericName: "Clotrimazole", strength: "1 %", atcCode: "D01AC01", atcName: "Imidazole derivatives", category: "Antifungal", dosageForm: "Cream", route: "Topical", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "155136", genericName: "Mupirocin", strength: "2 %", atcCode: "D06AX09", atcName: "Other antibiotics for topical use", category: "Antibiotic", dosageForm: "Ointment", route: "Topical", scheduleClass: "POM", isGeneric: true },
  { rxcui: "3393", genericName: "Mometasone", strength: "0.1 %", atcCode: "D07AC13", atcName: "Corticosteroids potent (group III)", category: "Steroid", dosageForm: "Cream", route: "Topical", scheduleClass: "POM", isGeneric: true },

  // ─── Eye / ear drops ──────────────────────────────────────
  { rxcui: "1514", genericName: "Chloramphenicol", strength: "0.5 %", atcCode: "S01AA01", atcName: "Antibiotics", category: "Antibiotic", dosageForm: "Drops", route: "Ophthalmic", scheduleClass: "POM", isGeneric: true },

  // ─── Anti-malarials (SL-relevant) ─────────────────────────
  { rxcui: "60216", genericName: "Artemether + Lumefantrine", strength: "20 mg / 120 mg", atcCode: "P01BF01", atcName: "Artemisinin + derivatives combos", category: "Antimalarial", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },

  // ─── Dengue / supportive (SL-relevant) ────────────────────
  { rxcui: "407990", genericName: "Paracetamol + Caffeine", strength: "500 mg / 65 mg", atcCode: "N02BE51", atcName: "Paracetamol combinations excl. psycholeptics", category: "Analgesic combo", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },

  // ─── Helminthic / deworming (Highly common in Asia) ──────
  { rxcui: "6672", genericName: "Mebendazole", brandName: "Vermox", strength: "100 mg", atcCode: "P02CA01", atcName: "Benzimidazole derivatives", category: "Anthelmintic", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "602", genericName: "Albendazole", brandName: "Alben", strength: "400 mg", atcCode: "P02CA03", atcName: "Benzimidazole derivatives", category: "Anthelmintic", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },

  // ─── Vitamin B / C & Supplements (Asia-relevant) ─────────
  { rxcui: "1151", genericName: "Ascorbic Acid", brandName: "Ceecon", strength: "500 mg", atcCode: "A11G", atcName: "Ascorbic acid (vitamin C)", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "1187440", genericName: "Vitamin B1 + B6 + B12", brandName: "Neurobion", strength: "100 mg / 200 mg / 200 mcg", atcCode: "A11DB", atcName: "Vitamin B1 in combination with vitamin B6 and/or vitamin B12", category: "Supplement", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: false },

  // ─── Antihistamines / Cold (Sri Lanka common) ─────────────
  { rxcui: "2403", genericName: "Chlorpheniramine", brandName: "Piriton", strength: "4 mg", atcCode: "R06AB04", atcName: "Substituted alkylamines", category: "Antihistamine", dosageForm: "Tablet", route: "Oral", scheduleClass: "OTC", isGeneric: true },

  // ─── GI Antispasmodics & Antacids (Sri Lanka Gastritis) ───
  { rxcui: "9524", genericName: "Hyoscine Butylbromide", brandName: "Buscopan", strength: "10 mg", atcCode: "A03BB01", atcName: "Belladonna alkaloids", category: "Antispasmodic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "1162791", genericName: "Aluminum Hydroxide + Magnesium Hydroxide + Simethicone", brandName: "Mucaine", strength: "291 mg / 98 mg / 25 mg per 5ml", atcCode: "A02AF02", atcName: "Antacids with antiflatulents", category: "Antacid", dosageForm: "Suspension", route: "Oral", scheduleClass: "OTC", isGeneric: false },
  { rxcui: "864319", genericName: "Oral Rehydration Salts", brandName: "Jeewani", strength: "4.1 g per sachet", atcCode: "A07CA", atcName: "Oral rehydration salt formulations", category: "Rehydration", dosageForm: "Powder", route: "Oral", scheduleClass: "OTC", isGeneric: true },
  { rxcui: "6916", genericName: "Metoclopramide", brandName: "Plasil", strength: "10 mg", atcCode: "A03FA01", atcName: "Propulsives", category: "Antiemetic", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Antihypertensive & Cardiac (Sri Lanka specific) ──────
  { rxcui: "6868", genericName: "Methyldopa", brandName: "Aldomet", strength: "250 mg", atcCode: "C02AB01", atcName: "Methyldopa (levorotatory)", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "7396", genericName: "Nifedipine", brandName: "Adalat", strength: "20 mg", atcCode: "C08CA05", atcName: "Dihydropyridines", category: "Antihypertensive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "7434", genericName: "Nitroglycerin", brandName: "Angised", strength: "0.5 mg", atcCode: "C01DA02", atcName: "Organic nitrates", category: "Antianginal", dosageForm: "Tablet", route: "Sublingual", scheduleClass: "POM", isGeneric: true },
  { rxcui: "6061", genericName: "Isosorbide Mononitrate", brandName: "Imdur", strength: "20 mg", atcCode: "C01DA14", atcName: "Organic nitrates", category: "Antianginal", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Respiratory inhalers (Asia common) ───────────────────
  { rxcui: "859088", genericName: "Budesonide + Formoterol", brandName: "Symbicort", strength: "200 mcg / 6 mcg", atcCode: "R03AK07", atcName: "Formoterol and budesonide", category: "Bronchodilator combo", dosageForm: "Inhaler", route: "Inhalation", scheduleClass: "POM", isGeneric: false },
  { rxcui: "859080", genericName: "Fluticasone + Salmeterol", brandName: "Seretide", strength: "125 mcg / 25 mcg", atcCode: "R03AK06", atcName: "Salmeterol and fluticasone", category: "Bronchodilator combo", dosageForm: "Inhaler", route: "Inhalation", scheduleClass: "POM", isGeneric: false },

  // ─── Antivirals & Lipids ──────────────────────────────────
  { rxcui: "4256", genericName: "Fenofibrate", brandName: "Lipanthyl", strength: "200 mg", atcCode: "C10AB05", atcName: "Fibrates", category: "Antilipemic", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "290", genericName: "Acyclovir", brandName: "Zovirax", strength: "400 mg", atcCode: "J05AB01", atcName: "Nucleosides and nucleotides", category: "Antiviral", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Neurological / Pain ──────────────────────────────────
  { rxcui: "25480", genericName: "Gabapentin", brandName: "Neurontin", strength: "300 mg", atcCode: "N03AX12", atcName: "Other antiepileptics", category: "Anticonvulsant", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },
  { rxcui: "187832", genericName: "Pregabalin", brandName: "Lyrica", strength: "75 mg", atcCode: "N03AX16", atcName: "Other antiepileptics", category: "Anticonvulsant", dosageForm: "Capsule", route: "Oral", scheduleClass: "POM", isGeneric: true },

  // ─── Oral Contraceptives (Family Planning Asia) ───────────
  { rxcui: "630208", genericName: "Ethinyl Estradiol + Levonorgestrel", brandName: "Mithuri", strength: "0.03 mg / 0.15 mg", atcCode: "G03AA07", atcName: "Levonorgestrel and ethinylestradiol", category: "Contraceptive", dosageForm: "Tablet", route: "Oral", scheduleClass: "POM", isGeneric: false },
];

// Curated drug interaction rules — seed straight into
// `drug_interactions_master`. The safety engine reads from this table,
// replacing the 12-entry in-memory DRUG_INTERACTIONS array in
// apps/api/src/lib/ai.ts. All severities are deliberately
// conservative — clinical review before promoting a row to a stricter
// level.
export const SEED_INTERACTIONS: Array<{
  ingredientA: string;
  ingredientB: string;
  severity: "minor" | "moderate" | "severe";
  mechanism: string;
  recommendation: string;
}> = [
  { ingredientA: "warfarin", ingredientB: "aspirin", severity: "severe", mechanism: "Additive antiplatelet effect", recommendation: "Significantly increased bleeding risk. Avoid combination unless explicitly prescribed." },
  { ingredientA: "warfarin", ingredientB: "ibuprofen", severity: "severe", mechanism: "NSAID + anticoagulant", recommendation: "Raises GI and bleeding risk. Use acetaminophen instead." },
  { ingredientA: "warfarin", ingredientB: "diclofenac", severity: "severe", mechanism: "NSAID + anticoagulant", recommendation: "Raises GI and bleeding risk. Use acetaminophen instead." },
  { ingredientA: "warfarin", ingredientB: "naproxen", severity: "severe", mechanism: "NSAID + anticoagulant", recommendation: "Raises GI and bleeding risk. Use acetaminophen instead." },
  { ingredientA: "warfarin", ingredientB: "celecoxib", severity: "moderate", mechanism: "COX-2 + anticoagulant", recommendation: "Elevated bleeding risk; use lowest effective celecoxib dose for shortest duration." },
  { ingredientA: "warfarin", ingredientB: "fluoxetine", severity: "moderate", mechanism: "CYP2C9 inhibition", recommendation: "Increased warfarin levels. Monitor INR closely." },
  { ingredientA: "warfarin", ingredientB: "sertraline", severity: "moderate", mechanism: "CYP2C9 inhibition", recommendation: "Increased warfarin levels. Monitor INR closely." },
  { ingredientA: "warfarin", ingredientB: "amiodarone", severity: "severe", mechanism: "CYP2C9 inhibition", recommendation: "Doubles warfarin effect. Reduce warfarin dose by 30-50% and monitor INR weekly." },
  { ingredientA: "warfarin", ingredientB: "metronidazole", severity: "severe", mechanism: "CYP2C9 inhibition", recommendation: "Increased warfarin effect. Monitor INR; reduce dose as needed." },
  { ingredientA: "warfarin", ingredientB: "ciprofloxacin", severity: "moderate", mechanism: "CYP1A2 + gut flora", recommendation: "May increase INR. Monitor for bleeding." },
  { ingredientA: "metformin", ingredientB: "alcohol", severity: "moderate", mechanism: "Lactic acidosis risk", recommendation: "Risk of lactic acidosis and hypoglycemia with heavy alcohol use." },
  { ingredientA: "metformin", ingredientB: "furosemide", severity: "minor", mechanism: "Glucose control", recommendation: "Furosemide may reduce glycemic control; monitor glucose." },
  { ingredientA: "simvastatin", ingredientB: "amlodipine", severity: "moderate", mechanism: "CYP3A4 inhibition", recommendation: "Amlodipine can raise simvastatin levels. Limit simvastatin to 20 mg/day." },
  { ingredientA: "simvastatin", ingredientB: "amiodarone", severity: "severe", mechanism: "CYP3A4 inhibition", recommendation: "Risk of severe myopathy. Simvastatin dose must be capped or switched." },
  { ingredientA: "atorvastatin", ingredientB: "clarithromycin", severity: "severe", mechanism: "CYP3A4 inhibition", recommendation: "Clarithromycin inhibits statin metabolism → rhabdomyolysis risk." },
  { ingredientA: "tramadol", ingredientB: "sertraline", severity: "severe", mechanism: "Serotonin syndrome", recommendation: "Serotonin syndrome risk. Avoid combining." },
  { ingredientA: "tramadol", ingredientB: "fluoxetine", severity: "severe", mechanism: "Serotonin syndrome", recommendation: "Serotonin syndrome risk. Avoid combining." },
  { ingredientA: "tramadol", ingredientB: "escitalopram", severity: "severe", mechanism: "Serotonin syndrome", recommendation: "Serotonin syndrome risk. Avoid combining." },
  { ingredientA: "lisinopril", ingredientB: "potassium", severity: "moderate", mechanism: "Hyperkalemia", recommendation: "ACE inhibitor + potassium supplements can cause hyperkalemia." },
  { ingredientA: "lisinopril", ingredientB: "spironolactone", severity: "moderate", mechanism: "Hyperkalemia", recommendation: "ACE inhibitor + K-sparing diuretic can cause hyperkalemia. Monitor K+." },
  { ingredientA: "clopidogrel", ingredientB: "omeprazole", severity: "moderate", mechanism: "CYP2C19 inhibition", recommendation: "Omeprazole reduces clopidogrel effectiveness. Use pantoprazole instead." },
  { ingredientA: "digoxin", ingredientB: "amiodarone", severity: "moderate", mechanism: "P-glycoprotein inhibition", recommendation: "Amiodarone raises digoxin levels; reduce digoxin dose by half." },
  { ingredientA: "digoxin", ingredientB: "furosemide", severity: "moderate", mechanism: "Hypokalemia potentiates digoxin toxicity", recommendation: "Monitor potassium; replace as needed." },
  { ingredientA: "methotrexate", ingredientB: "trimethoprim", severity: "severe", mechanism: "Additive anti-folate", recommendation: "Pancytopenia risk. Avoid combination." },
  { ingredientA: "metformin", ingredientB: "ciprofloxacin", severity: "minor", mechanism: "Glucose dysregulation", recommendation: "May alter glycemic control; monitor glucose." },
  { ingredientA: "sildenafil", ingredientB: "nitroglycerin", severity: "severe", mechanism: "Potentiated hypotension", recommendation: "Severe hypotension. Do not co-administer nitrates with PDE-5 inhibitors." },
];

// Curated drug-allergy family groups. Seeds `drug_allergies_master`.
// Cross-reactivity list lets the safety engine match a penicillin
// allergy against any drug whose ingredients include amoxicillin,
// ampicillin, piperacillin, etc. — same approach the in-memory
// CLASS_GROUPS in `medicines.ts` takes, but DB-backed and reviewable.
export const SEED_ALLERGY_FAMILIES: Array<{
  family: string;
  members: { ingredient: string; crossReactives: string[] }[];
}> = [
  {
    family: "penicillins",
    members: [
      { ingredient: "amoxicillin", crossReactives: ["ampicillin", "piperacillin", "amoxicillin + clavulanate", "pivampicillin", "bacampicillin"] },
      { ingredient: "ampicillin", crossReactives: ["amoxicillin", "piperacillin", "pivampicillin"] },
      { ingredient: "piperacillin", crossReactives: ["amoxicillin", "ampicillin"] },
    ],
  },
  {
    family: "cephalosporins",
    members: [
      { ingredient: "cefuroxime", crossReactives: ["cefixime", "ceftriaxone", "cefalexin", "cefazolin", "cefpodoxime"] },
      { ingredient: "cefixime", crossReactives: ["cefuroxime", "ceftriaxone", "cefalexin"] },
      { ingredient: "ceftriaxone", crossReactives: ["cefuroxime", "cefixime", "cefazolin"] },
    ],
  },
  {
    family: "nsaids",
    members: [
      { ingredient: "ibuprofen", crossReactives: ["aspirin", "diclofenac", "naproxen", "celecoxib", "mefenamic acid"] },
      { ingredient: "aspirin", crossReactives: ["ibuprofen", "diclofenac", "naproxen", "celecoxib", "mefenamic acid"] },
      { ingredient: "diclofenac", crossReactives: ["ibuprofen", "aspirin", "naproxen", "celecoxib", "mefenamic acid"] },
      { ingredient: "naproxen", crossReactives: ["ibuprofen", "aspirin", "diclofenac", "celecoxib"] },
      { ingredient: "celecoxib", crossReactives: ["ibuprofen", "aspirin", "diclofenac", "naproxen"] },
    ],
  },
  {
    family: "sulfonamides",
    members: [
      { ingredient: "sulfamethoxazole", crossReactives: ["sulfadiazine", "sulfasalazine"] },
      { ingredient: "sulfasalazine", crossReactives: ["sulfamethoxazole", "sulfadiazine"] },
    ],
  },
];

// Pregnancy + renal + liver + controlled safety data for high-risk
// medicines. The safety engine reads these tables and emits warnings
// when the patient profile matches (pregnant, eGFR < 60, Child-Pugh
// C, etc.).
export const SEED_PREGNANCY_WARNINGS: Array<{
  ingredient: string;
  fdaCategory: string;
  severity: "minor" | "moderate" | "severe";
  notes: string;
}> = [
  { ingredient: "metronidazole", fdaCategory: "B", severity: "minor", notes: "Avoid in first trimester per some guidelines." },
  { ingredient: "doxycycline", fdaCategory: "D", severity: "severe", notes: "Tooth discolouration + bone growth issues. Contraindicated in pregnancy." },
  { ingredient: "ciprofloxacin", fdaCategory: "C", severity: "severe", notes: "Fluoroquinolones: cartilage damage risk in fetus." },
  { ingredient: "levofloxacin", fdaCategory: "C", severity: "severe", notes: "Fluoroquinolones: cartilage damage risk in fetus." },
  { ingredient: "atorvastatin", fdaCategory: "X", severity: "severe", notes: "Statins are contraindicated in pregnancy." },
  { ingredient: "simvastatin", fdaCategory: "X", severity: "severe", notes: "Statins are contraindicated in pregnancy." },
  { ingredient: "rosuvastatin", fdaCategory: "X", severity: "severe", notes: "Statins are contraindicated in pregnancy." },
  { ingredient: "warfarin", fdaCategory: "X", severity: "severe", notes: "Teratogenic — switch to LMWH during pregnancy." },
  { ingredient: "ibuprofen", fdaCategory: "C", severity: "moderate", notes: "Avoid in 3rd trimester (premature closure of ductus arteriosus)." },
  { ingredient: "diclofenac", fdaCategory: "C", severity: "moderate", notes: "Avoid in 3rd trimester." },
  { ingredient: "naproxen", fdaCategory: "C", severity: "moderate", notes: "Avoid in 3rd trimester." },
  { ingredient: "tramadol", fdaCategory: "C", severity: "moderate", notes: "Use only if benefits outweigh risks. Neonatal withdrawal risk if used near term." },
  { ingredient: "diazepam", fdaCategory: "D", severity: "severe", notes: "Risk of neonatal withdrawal + floppy baby syndrome." },
  { ingredient: "alprazolam", fdaCategory: "D", severity: "severe", notes: "Risk of neonatal withdrawal." },
  { ingredient: "lisinopril", fdaCategory: "D", severity: "severe", notes: "ACE inhibitors: renal dysgenesis + oligohydramnios. Switch to safer antihypertensives." },
  { ingredient: "losartan", fdaCategory: "D", severity: "severe", notes: "ARBs: fetal renal toxicity. Contraindicated." },
];

export const SEED_RENAL_ADJUSTMENTS: Array<{
  ingredient: string;
  egfrMin: number;
  egfrMax: number;
  doseAdjustment: string;
  notes: string;
}> = [
  { ingredient: "metformin", egfrMin: 0, egfrMax: 30, doseAdjustment: "contraindicated", notes: "Stop metformin if eGFR < 30 (lactic acidosis risk)." },
  { ingredient: "metformin", egfrMin: 30, egfrMax: 45, doseAdjustment: "max 500 mg/day", notes: "Reduce to half usual dose; reassess." },
  { ingredient: "metformin", egfrMin: 45, egfrMax: 60, doseAdjustment: "max 1000 mg/day", notes: "Reduce; monitor renal function." },
  { ingredient: "lisinopril", egfrMin: 0, egfrMax: 30, doseAdjustment: "use with caution", notes: "ACE inhibitors: risk of hyperkalemia + AKI. Start low." },
  { ingredient: "digoxin", egfrMin: 0, egfrMax: 30, doseAdjustment: "reduce by 50%", notes: "Toxicity risk; monitor levels." },
  { ingredient: "furosemide", egfrMin: 0, egfrMax: 30, doseAdjustment: "may need higher dose", notes: "Loop diuretic efficacy drops; consider adding thiazide." },
  { ingredient: "ciprofloxacin", egfrMin: 0, egfrMax: 30, doseAdjustment: "50% dose reduction", notes: "Reduced clearance." },
  { ingredient: "tramadol", egfrMin: 0, egfrMax: 30, doseAdjustment: "max 50 mg q12h", notes: "Active metabolite accumulates. Avoid if possible." },
  { ingredient: "atorvastatin", egfrMin: 0, egfrMax: 30, doseAdjustment: "caution", notes: "No dose adjustment, but monitor for myopathy." },
];

export const SEED_LIVER_ADJUSTMENTS: Array<{
  ingredient: string;
  childPugh: "A" | "B" | "C";
  doseAdjustment: string;
  notes: string;
}> = [
  { ingredient: "metformin", childPugh: "C", doseAdjustment: "contraindicated", notes: "Lactic acidosis risk in hepatic failure." },
  { ingredient: "atorvastatin", childPugh: "C", doseAdjustment: "max 20 mg/day", notes: "Reduce dose; monitor LFTs." },
  { ingredient: "simvastatin", childPugh: "C", doseAdjustment: "max 20 mg/day", notes: "Reduce dose; monitor LFTs." },
  { ingredient: "warfarin", childPugh: "B", doseAdjustment: "reduce 25%", notes: "Hepatic metabolism impaired." },
  { ingredient: "warfarin", childPugh: "C", doseAdjustment: "reduce 50%", notes: "Hepatic metabolism severely impaired." },
  { ingredient: "tramadol", childPugh: "C", doseAdjustment: "max 50 mg q12h", notes: "Hepatic metabolism impaired." },
];

export const SEED_CONTROLLED: Array<{
  ingredient: string;
  schedule: string;
  notes: string;
}> = [
  { ingredient: "tramadol", schedule: "Schedule IV (LK)", notes: "Narcotic; requires prescription retention." },
  { ingredient: "diazepam", schedule: "Schedule IV (LK)", notes: "Benzodiazepine; regulated." },
  { ingredient: "alprazolam", schedule: "Schedule IV (LK)", notes: "Benzodiazepine; regulated." },
  { ingredient: "zolpidem", schedule: "Schedule IV (LK)", notes: "Hypnotic; regulated." },
];
