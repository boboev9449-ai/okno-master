import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { computeTotals } from "@/lib/okno/calc";
import {
  defaultSettings,
  deleteCustomerError,
  deleteObjectError,
  formatOrderNumber,
  normalizeMaterial,
  nowIso,
  parseBackup,
  seedMaterials,
  serializeBackup,
  uid,
  upsertById,
} from "@/lib/okno/domain";
import type {
  Customer,
  Material,
  MaterialCategory,
  Order,
  Settings,
  SiteObject,
} from "@/lib/okno/types";

interface OknoState {
  customers: Customer[];
  objects: SiteObject[];
  materials: Material[];
  orders: Order[];
  settings: Settings;
  seq: number;
  notice: string | null;
  setNotice: (notice: string | null) => void;
  saveCustomer: (customer: Customer) => void;
  deleteCustomer: (id: string) => string | null;
  saveObject: (object: SiteObject) => void;
  deleteObject: (id: string) => string | null;
  saveMaterial: (material: Material) => void;
  deleteMaterial: (id: string) => void;
  restoreSeedMaterials: () => void;
  saveOrder: (order: Order, options?: { allocateNumber?: boolean }) => Order;
  deleteOrder: (id: string) => void;
  duplicateOrder: (id: string) => string | null;
  updateSettings: (patch: Partial<Settings>) => void;
  exportBackup: () => string;
  importBackup: (raw: string) => string | null;
}

const memoryStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  key: () => null,
  length: 0,
  clear: () => undefined,
};

export const useOkno = create<OknoState>()(
  persist(
    (set, get) => ({
      customers: [],
      objects: [],
      materials: seedMaterials(),
      orders: [],
      settings: defaultSettings(),
      seq: 0,
      notice: null,
      setNotice: (notice) => set({ notice }),
      saveCustomer: (customer) => set({ customers: upsertById(get().customers, customer) }),
      deleteCustomer: (id) => {
        const error = deleteCustomerError(id, get().objects, get().orders);
        if (error) return error;
        set({ customers: get().customers.filter((row) => row.id !== id) });
        return null;
      },
      saveObject: (object) => set({ objects: upsertById(get().objects, object) }),
      deleteObject: (id) => {
        const error = deleteObjectError(id, get().orders);
        if (error) return error;
        set({ objects: get().objects.filter((row) => row.id !== id) });
        return null;
      },
      saveMaterial: (material) =>
        set({ materials: upsertById(get().materials, normalizeMaterial(material)) }),
      deleteMaterial: (id) => set({ materials: get().materials.filter((row) => row.id !== id) }),
      restoreSeedMaterials: () => set({ materials: seedMaterials() }),
      saveOrder: (order, options) => {
        let seq = get().seq;
        let number = order.number;
        if (options?.allocateNumber) {
          seq += 1;
          number = formatOrderNumber(seq);
        }
        const totals = computeTotals(
          order.lines.map((line) => ({ sale: line.calc.sale, cost: line.calc.cost })),
          order.discountMode,
          order.discountValue,
          order.extraSale,
          order.extraCost,
          get().settings.rounding,
        );
        const next: Order = { ...order, number, totals, updatedAt: nowIso() };
        set({ orders: upsertById(get().orders, next), seq });
        return next;
      },
      deleteOrder: (id) => set({ orders: get().orders.filter((row) => row.id !== id) }),
      duplicateOrder: (id) => {
        const source = get().orders.find((row) => row.id === id);
        if (!source) return null;
        const seq = get().seq + 1;
        const stamp = nowIso();
        const copy: Order = {
          ...structuredClone(source),
          id: uid(),
          number: formatOrderNumber(seq),
          status: "draft",
          date: stamp.slice(0, 10),
          createdAt: stamp,
          updatedAt: stamp,
          comment: source.comment
            ? `${source.comment}\nКопия ${source.number}`
            : `Копия ${source.number}`,
          lines: structuredClone(source.lines).map((line) => ({ ...line, id: uid() })),
        };
        set({ orders: [copy, ...get().orders], seq });
        return copy.id;
      },
      updateSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      exportBackup: () => {
        const { customers, objects, materials, orders, settings, seq } = get();
        return serializeBackup({ customers, objects, materials, orders, settings, seq });
      },
      importBackup: (raw) => {
        const parsed = parseBackup(raw);
        if (!parsed.ok) return parsed.error;
        set({
          customers: parsed.data.customers,
          objects: parsed.data.objects,
          materials: parsed.data.materials,
          orders: parsed.data.orders,
          settings: parsed.data.settings,
          seq: parsed.data.seq,
          notice: "Резервная копия восстановлена.",
        });
        return null;
      },
    }),
    {
      name: "okno-master-pro",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? memoryStorage : window.localStorage,
      ),
      skipHydration: true,
      version: 1,
      partialize: (state) => ({
        customers: state.customers,
        objects: state.objects,
        materials: state.materials,
        orders: state.orders,
        settings: state.settings,
        seq: state.seq,
      }),
    },
  ),
);

export function useHydrated() {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<{
    ready: boolean;
    error: string | null;
  }>({
    ready: false,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    setStatus({ ready: false, error: null });
    void (async () => {
      try {
        const currentData = localStorage.getItem("okno-master-pro");
        const legacyKeys = Array.from({ length: localStorage.length }, (_, index) =>
          localStorage.key(index),
        ).filter((key): key is string => key !== null && key.startsWith("okno-master-pro:"));

        if (currentData === null && legacyKeys.length === 1) {
          const legacyData = localStorage.getItem(legacyKeys[0]!);
          if (legacyData !== null) localStorage.setItem("okno-master-pro", legacyData);
        }

        await useOkno.persist.rehydrate();
        if (currentData === null && legacyKeys.length > 1) {
          useOkno
            .getState()
            .setNotice(
              "Данные нескольких прежних аккаунтов оставлены без изменений. При наличии JSON-резервной копии загрузите нужную копию в разделе «Настройки».",
            );
        }
        if (alive) setStatus({ ready: true, error: null });
      } catch (error) {
        console.error("Не удалось загрузить данные из этого браузера.", error);
        if (alive) {
          setStatus({
            ready: false,
            error:
              "Не удалось загрузить данные из этого браузера. Проверьте свободное место и попробуйте ещё раз.",
          });
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [attempt]);

  return {
    ready: status.ready,
    error: status.error,
    retry: () => setAttempt((value) => value + 1),
  };
}

export function materialsByCategory(materials: Material[], category: MaterialCategory): Material[] {
  return materials.filter((material) => material.category === category);
}

export function customerName(customers: Customer[], id: string): string {
  return customers.find((customer) => customer.id === id)?.name ?? "Клиент удалён";
}

export function objectName(objects: SiteObject[], id: string): string {
  return objects.find((object) => object.id === id)?.name ?? "Объект удалён";
}
