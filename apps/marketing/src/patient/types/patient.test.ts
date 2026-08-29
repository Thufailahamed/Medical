import { describe, expectTypeOf, it } from "vitest";

import type { AllergyRow, MedicineRow, VitalType } from "@/patient/types/patient";
import type {
  AllergyRow as SharedAllergyRow,
  MedicineRow as SharedMedicineRow,
  VitalType as SharedVitalType,
} from "@healthcare/shared/contracts";

/**
 * The web-side type module is a shim over the shared contract. If these
 * ever diverge, mobile and web are describing the same endpoint two
 * different ways — which is the exact failure this package exists to stop.
 */
describe("@/patient/types/patient", () => {
  it("re-exports the shared contract types unchanged", () => {
    expectTypeOf<AllergyRow>().toEqualTypeOf<SharedAllergyRow>();
    expectTypeOf<MedicineRow>().toEqualTypeOf<SharedMedicineRow>();
    expectTypeOf<VitalType>().toEqualTypeOf<SharedVitalType>();
  });
});
