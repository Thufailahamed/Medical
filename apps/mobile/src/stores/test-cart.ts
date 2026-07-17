import { create } from "zustand";

export type CartItem = {
  testId: string;
  testName: string;
  testSlug: string;
  price: number;
  sampleType: string;
  fastingRequired: boolean;
  fastingHours: number;
  labPartnerId: string;
};

type TestCartState = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (testId: string) => void;
  clearCart: () => void;
  isInCart: (testId: string) => boolean;
  totalPrice: () => number;
  itemCount: () => number;
  hasItems: () => boolean;
};

export const useTestCartStore = create<TestCartState>((set, get) => ({
  items: [],

  addItem: (item) => {
    const existing = get().items.find((i) => i.testId === item.testId);
    if (existing) return; // No duplicates
    set({ items: [...get().items, item] });
  },

  removeItem: (testId) => {
    set({ items: get().items.filter((i) => i.testId !== testId) });
  },

  clearCart: () => set({ items: [] }),

  isInCart: (testId) => get().items.some((i) => i.testId === testId),

  totalPrice: () => get().items.reduce((sum, i) => sum + i.price, 0),

  itemCount: () => get().items.length,

  hasItems: () => get().items.length > 0,
}));
