import { create } from "zustand";

export type InsuranceDependentDraft = {
  name: string;
  relation: string;
  dob?: string;
  gender?: "male" | "female" | "other";
  nic?: string;
};

export type InsuranceQuoteDraft = {
  planId: string | null;
  planName: string | null;
  billingCycle: "monthly" | "annual";
  memberAge?: number;
  memberGender?: "male" | "female" | "other";
  members: InsuranceDependentDraft[];
  preExisting: string[];
};

type InsuranceStore = {
  quote: InsuranceQuoteDraft;
  setBillingCycle: (c: "monthly" | "annual") => void;
  setPlan: (id: string, name: string) => void;
  setAge: (age: number | undefined) => void;
  setGender: (g: "male" | "female" | "other" | undefined) => void;
  addMember: (m: InsuranceDependentDraft) => void;
  removeMember: (idx: number) => void;
  togglePreExisting: (cond: string) => void;
  reset: () => void;

  // After successful enroll, we keep the id so the payment screen knows.
  draftEnrollmentId: string | null;
  setDraftEnrollmentId: (id: string | null) => void;
};

const blankQuote: InsuranceQuoteDraft = {
  planId: null,
  planName: null,
  billingCycle: "annual",
  members: [],
  preExisting: [],
};

export const useInsuranceStore = create<InsuranceStore>((set, get) => ({
  quote: { ...blankQuote },

  setBillingCycle: (c) =>
    set({ quote: { ...get().quote, billingCycle: c } }),
  setPlan: (id, name) =>
    set({ quote: { ...get().quote, planId: id, planName: name } }),
  setAge: (age) => set({ quote: { ...get().quote, memberAge: age } }),
  setGender: (g) => set({ quote: { ...get().quote, memberGender: g } }),
  addMember: (m) =>
    set({
      quote: { ...get().quote, members: [...get().quote.members, m] },
    }),
  removeMember: (idx) =>
    set({
      quote: {
        ...get().quote,
        members: get().quote.members.filter((_, i) => i !== idx),
      },
    }),
  togglePreExisting: (cond) => {
    const list = get().quote.preExisting;
    set({
      quote: {
        ...get().quote,
        preExisting: list.includes(cond)
          ? list.filter((c) => c !== cond)
          : [...list, cond],
      },
    });
  },
  reset: () => set({ quote: { ...blankQuote }, draftEnrollmentId: null }),

  draftEnrollmentId: null,
  setDraftEnrollmentId: (id) => set({ draftEnrollmentId: id }),
}));