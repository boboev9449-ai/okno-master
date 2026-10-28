import { buildCells, calcFromParts, defaultOpenings } from "./calc.ts";
import type {
  BackupFile,
  ConstructionDraft,
  Customer,
  FrozenRates,
  Kind,
  Material,
  MaterialCategory,
  Opening,
  Order,
  OrderLine,
  OrderStatus,
  Settings,
  SiteObject,
  Unit,
} from "./types.ts";

export const KIND_LABEL: Record<Kind, string> = {
  single: "Одностворчатое окно",
  double: "Двухстворчатое окно",
  triple: "Трёхстворчатое окно",
  fixed: "Глухое окно",
  turn: "Поворотная створка",
  tiltTurn: "Поворотно-откидная створка",
  balconyBlock: "Балконный блок",
  balconyDoor: "Балконная дверь",
  entranceDoor: "Пластиковая входная дверь",
  sliding: "Раздвижная система",
  custom: "Произвольная конфигурация",
};

export const OPENING_LABEL: Record<Opening, string> = {
  fixed: "Глухая",
  turn: "Поворотная",
  tilt: "Откидная",
  tiltTurn: "Поворотно-откидная",
  sliding: "Раздвижная",
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft: "Черновик",
  calculated: "Расчёт готов",
  awaiting: "Ожидает подтверждения",
  confirmed: "Подтверждён",
  production: "В производстве",
  ready: "Готов",
  delivered: "Доставлен",
  installed: "Установлен",
  cancelled: "Отменён",
};

export const STATUS_ORDER: OrderStatus[] = [
  "draft",
  "calculated",
  "awaiting",
  "confirmed",
  "production",
  "ready",
  "delivered",
  "installed",
  "cancelled",
];

export const CATEGORY_LABEL: Record<MaterialCategory, string> = {
  profile: "Профили",
  glass: "Стеклопакеты",
  hardware: "Фурнитура",
  sill: "Подоконники",
  drip: "Отливы",
  mosquito: "Москитные сетки",
  seal: "Уплотнители",
  consumable: "Расходные материалы",
  install: "Монтажные работы",
  service: "Дополнительные услуги",
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as MaterialCategory[];

export const UNIT_LABEL: Record<Unit, string> = {
  m2: "м²",
  lm: "м.п.",
  pcs: "шт.",
  set: "компл.",
};

export function defaultSettings(): Settings {
  return {
    companyName: "Моя компания",
    phone: "",
    address: "",
    email: "",
    logoDataUrl: null,
    currency: "TJS",
    rounding: "0.01",
    minGlassAreaM2: 0,
    installSalePerM2: 70,
    installCostPerM2: 35,
    defaultMarkupPercent: 30,
    minWidthMm: 300,
    maxWidthMm: 6000,
    minHeightMm: 300,
    maxHeightMm: 6000,
    profileDeductionMm: 0,
    defaultMethod: "elements",
    theme: "light",
  };
}

function mat(
  partial: Pick<Material, "id" | "category" | "name" | "unit" | "costPrice" | "salePrice"> &
    Partial<Material>,
): Material {
  const unit = partial.unit;
  const cost = partial.costPrice;
  const sale = partial.salePrice;
  return {
    manufacturer: partial.manufacturer ?? "",
    sku: partial.sku ?? "",
    description: partial.description ?? "",
    costPerM2: partial.costPerM2 ?? (unit === "m2" ? cost : 0),
    salePerM2: partial.salePerM2 ?? (unit === "m2" ? sale : 0),
    costPerLm: partial.costPerLm ?? (unit === "lm" ? cost : 0),
    salePerLm: partial.salePerLm ?? (unit === "lm" ? sale : 0),
    ...partial,
  };
}

export function seedMaterials(): Material[] {
  return [
    mat({
      id: "mat-profile-60",
      category: "profile",
      name: "Профиль 60 мм, белый",
      manufacturer: "Стартовый прайс",
      sku: "PR-60",
      unit: "m2",
      costPrice: 340,
      salePrice: 480,
      costPerM2: 340,
      salePerM2: 480,
      costPerLm: 68,
      salePerLm: 95,
      description: "Цена за м² для метода по площади и за м.п. для метода по элементам.",
    }),
    mat({
      id: "mat-profile-70",
      category: "profile",
      name: "Профиль 70 мм, белый",
      manufacturer: "Стартовый прайс",
      sku: "PR-70",
      unit: "m2",
      costPrice: 400,
      salePrice: 560,
      costPerM2: 400,
      salePerM2: 560,
      costPerLm: 78,
      salePerLm: 110,
    }),
    mat({
      id: "mat-profile-70l",
      category: "profile",
      name: "Профиль 70 мм, ламинация",
      manufacturer: "Стартовый прайс",
      sku: "PR-70L",
      unit: "m2",
      costPrice: 510,
      salePrice: 690,
      costPerM2: 510,
      salePerM2: 690,
      costPerLm: 100,
      salePerLm: 140,
    }),
    mat({
      id: "mat-glass-24",
      category: "glass",
      name: "Стеклопакет 24 мм",
      manufacturer: "Стартовый прайс",
      sku: "GL-24",
      unit: "m2",
      costPrice: 110,
      salePrice: 160,
    }),
    mat({
      id: "mat-glass-32",
      category: "glass",
      name: "Стеклопакет 32 мм",
      manufacturer: "Стартовый прайс",
      sku: "GL-32",
      unit: "m2",
      costPrice: 145,
      salePrice: 210,
    }),
    mat({
      id: "mat-glass-40",
      category: "glass",
      name: "Стеклопакет 40 мм",
      manufacturer: "Стартовый прайс",
      sku: "GL-40",
      unit: "m2",
      costPrice: 190,
      salePrice: 280,
    }),
    mat({
      id: "mat-hw-turn",
      category: "hardware",
      name: "Фурнитура поворотная",
      sku: "HW-T",
      unit: "set",
      costPrice: 120,
      salePrice: 180,
    }),
    mat({
      id: "mat-hw-tt",
      category: "hardware",
      name: "Фурнитура поворотно-откидная",
      sku: "HW-TT",
      unit: "set",
      costPrice: 175,
      salePrice: 260,
    }),
    mat({
      id: "mat-hw-door",
      category: "hardware",
      name: "Фурнитура дверная",
      sku: "HW-D",
      unit: "set",
      costPrice: 230,
      salePrice: 340,
    }),
    mat({
      id: "mat-hw-slide",
      category: "hardware",
      name: "Фурнитура раздвижная",
      sku: "HW-S",
      unit: "set",
      costPrice: 290,
      salePrice: 420,
    }),
    mat({
      id: "mat-sill-200",
      category: "sill",
      name: "Подоконник 200 мм",
      sku: "SL-200",
      unit: "lm",
      costPrice: 32,
      salePrice: 55,
    }),
    mat({
      id: "mat-sill-300",
      category: "sill",
      name: "Подоконник 300 мм",
      sku: "SL-300",
      unit: "lm",
      costPrice: 44,
      salePrice: 75,
    }),
    mat({
      id: "mat-sill-400",
      category: "sill",
      name: "Подоконник 400 мм",
      sku: "SL-400",
      unit: "lm",
      costPrice: 58,
      salePrice: 95,
    }),
    mat({
      id: "mat-drip-zn",
      category: "drip",
      name: "Отлив оцинкованный",
      sku: "DR-ZN",
      unit: "lm",
      costPrice: 18,
      salePrice: 35,
    }),
    mat({
      id: "mat-drip-color",
      category: "drip",
      name: "Отлив окрашенный",
      sku: "DR-C",
      unit: "lm",
      costPrice: 28,
      salePrice: 48,
    }),
    mat({
      id: "mat-net-m2",
      category: "mosquito",
      name: "Москитная сетка",
      sku: "MS-M2",
      unit: "m2",
      costPrice: 45,
      salePrice: 90,
    }),
    mat({
      id: "mat-net-pc",
      category: "mosquito",
      name: "Москитная сетка, стандарт",
      sku: "MS-PC",
      unit: "pcs",
      costPrice: 60,
      salePrice: 120,
    }),
    mat({
      id: "mat-seal",
      category: "seal",
      name: "Уплотнитель",
      sku: "SE-1",
      unit: "lm",
      costPrice: 3,
      salePrice: 8,
    }),
    mat({
      id: "mat-foam",
      category: "consumable",
      name: "Пена монтажная",
      sku: "CN-F",
      unit: "pcs",
      costPrice: 15,
      salePrice: 25,
    }),
    mat({
      id: "mat-dismantle",
      category: "install",
      name: "Демонтаж",
      sku: "IN-D",
      unit: "m2",
      costPrice: 15,
      salePrice: 40,
    }),
    mat({
      id: "mat-delivery",
      category: "service",
      name: "Доставка по городу",
      sku: "SV-D",
      unit: "pcs",
      costPrice: 80,
      salePrice: 150,
    }),
    mat({
      id: "mat-lift",
      category: "service",
      name: "Подъём на этаж",
      sku: "SV-L",
      unit: "pcs",
      costPrice: 0,
      salePrice: 20,
    }),
  ];
}

export function uid(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function formatOrderNumber(seq: number, date = new Date()): string {
  return `ОМ-${date.getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function blankMaterial(category: MaterialCategory = "profile"): Material {
  return {
    id: uid(),
    category,
    name: "",
    manufacturer: "",
    sku: "",
    unit:
      category === "profile" || category === "glass"
        ? "m2"
        : category === "hardware"
          ? "set"
          : "pcs",
    costPrice: 0,
    salePrice: 0,
    costPerM2: 0,
    salePerM2: 0,
    costPerLm: 0,
    salePerLm: 0,
    description: "",
  };
}

export function normalizeMaterial(input: Material): Material {
  const m = {
    ...input,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    sku: input.sku.trim(),
  };
  if (m.category === "profile") {
    return { ...m, unit: "m2", salePrice: m.salePerM2, costPrice: m.costPerM2 };
  }
  if (m.unit === "m2") return { ...m, salePerM2: m.salePrice, costPerM2: m.costPrice };
  if (m.unit === "lm") return { ...m, salePerLm: m.salePrice, costPerLm: m.costPrice };
  return m;
}

export function blankDraft(settings: Settings, materials: Material[]): ConstructionDraft {
  const profile = materials.find((m) => m.category === "profile");
  const glass = materials.find((m) => m.category === "glass");
  const kind: Kind = "double";
  return {
    id: uid(),
    kind,
    widthMm: 1400,
    heightMm: 1400,
    qty: 1,
    profileId: profile?.id ?? "",
    profileColor: "Белый",
    openings: defaultOpenings(kind),
    doorWidthMm: 700,
    method: settings.defaultMethod,
    glassId: glass?.id ?? "",
    sillId: "",
    dripId: "",
    mosquitoMode: "none",
    mosquitoId: "",
    mosquitoPieces: 1,
    hardwareId: "",
    install: false,
    extras: [],
  };
}

export function withKind(draft: ConstructionDraft, kind: Kind): ConstructionDraft {
  return {
    ...draft,
    kind,
    openings: defaultOpenings(kind, draft.openings.length),
    doorWidthMm: kind === "balconyBlock" ? draft.doorWidthMm || 700 : draft.doorWidthMm,
  };
}

export function withSashCount(draft: ConstructionDraft, count: number): ConstructionDraft {
  const n = Math.min(6, Math.max(1, Math.round(count)));
  const openings = draft.openings.slice(0, n);
  while (openings.length < n) openings.push("turn");
  return { ...draft, kind: "custom", openings };
}

export function resolveRates(
  draft: ConstructionDraft,
  materials: Material[],
  settings: Settings,
): FrozenRates {
  const byId = (id: string) => materials.find((m) => m.id === id) ?? null;
  const profile = byId(draft.profileId);
  const glass = byId(draft.glassId);
  const sill = byId(draft.sillId);
  const drip = byId(draft.dripId);
  const mosquito = byId(draft.mosquitoId);
  const hardware = byId(draft.hardwareId);
  const extraLabels = draft.extras.map((extra) => {
    const material = byId(extra.materialId);
    return { id: extra.id, name: material?.name || "Материал", unit: material?.unit ?? "pcs" };
  });
  let mosquitoRates: FrozenRates["mosquito"] = null;
  if (draft.mosquitoMode === "area" && mosquito) {
    mosquitoRates = {
      mode: "area",
      salePerM2: mosquito.salePerM2 || mosquito.salePrice,
      costPerM2: mosquito.costPerM2 || mosquito.costPrice,
    };
  } else if (draft.mosquitoMode === "piece" && mosquito) {
    mosquitoRates = {
      mode: "piece",
      sale: mosquito.salePrice,
      cost: mosquito.costPrice,
      qty: draft.mosquitoPieces,
    };
  }
  return {
    profileName: profile?.name ?? "Профиль не выбран",
    glassName: glass?.name ?? null,
    sillName: sill?.name ?? null,
    dripName: drip?.name ?? null,
    mosquitoName: mosquitoRates ? (mosquito?.name ?? null) : null,
    hardwareName: hardware?.name ?? null,
    extraLabels,
    profile: {
      salePerM2: profile?.salePerM2 ?? 0,
      costPerM2: profile?.costPerM2 ?? 0,
      salePerLm: profile?.salePerLm ?? 0,
      costPerLm: profile?.costPerLm ?? 0,
    },
    glass: glass
      ? {
          salePerM2: glass.salePerM2 || glass.salePrice,
          costPerM2: glass.costPerM2 || glass.costPrice,
        }
      : null,
    sill: sill
      ? { salePerLm: sill.salePerLm || sill.salePrice, costPerLm: sill.costPerLm || sill.costPrice }
      : null,
    drip: drip
      ? { salePerLm: drip.salePerLm || drip.salePrice, costPerLm: drip.costPerLm || drip.costPrice }
      : null,
    mosquito: mosquitoRates,
    hardware: hardware ? { sale: hardware.salePrice, cost: hardware.costPrice } : null,
    extras: draft.extras.map((extra) => {
      const material = byId(extra.materialId);
      return {
        id: extra.id,
        sale: material?.salePrice ?? 0,
        cost: material?.costPrice ?? 0,
        qty: extra.qty,
      };
    }),
    install: draft.install
      ? { salePerM2: settings.installSalePerM2, costPerM2: settings.installCostPerM2 }
      : null,
    deductionMm: settings.profileDeductionMm,
    rounding: settings.rounding,
    minGlassAreaM2: Math.max(0, settings.minGlassAreaM2),
  };
}

export function priceLine(
  draft: ConstructionDraft,
  rates: FrozenRates,
): OrderLine | { error: string } {
  const built = buildCells(draft);
  if (built.error) return { error: built.error };
  const calc = calcFromParts({
    widthMm: draft.widthMm,
    heightMm: draft.heightMm,
    qty: draft.qty,
    method: draft.method,
    cells: built.cells,
    rates,
  });
  return {
    id: draft.id,
    draft: structuredClone(draft),
    rates: structuredClone(rates),
    cells: built.cells,
    calc,
  };
}

export function overlayQuantities(draft: ConstructionDraft, rates: FrozenRates): FrozenRates {
  return {
    ...rates,
    extras: draft.extras.map((extra) => {
      const previous = rates.extras.find((item) => item.id === extra.id);
      return { id: extra.id, qty: extra.qty, sale: previous?.sale ?? 0, cost: previous?.cost ?? 0 };
    }),
    extraLabels: rates.extraLabels.filter((label) =>
      draft.extras.some((extra) => extra.id === label.id),
    ),
    mosquito:
      draft.mosquitoMode === "piece" && rates.mosquito?.mode === "piece"
        ? { ...rates.mosquito, qty: draft.mosquitoPieces }
        : rates.mosquito,
    install: draft.install ? rates.install : null,
  };
}

export function sameKit(a: ConstructionDraft, b: ConstructionDraft): boolean {
  if (
    a.profileId !== b.profileId ||
    a.glassId !== b.glassId ||
    a.sillId !== b.sillId ||
    a.dripId !== b.dripId ||
    a.mosquitoId !== b.mosquitoId ||
    a.mosquitoMode !== b.mosquitoMode ||
    a.hardwareId !== b.hardwareId ||
    a.install !== b.install ||
    a.extras.length !== b.extras.length
  ) {
    return false;
  }
  return a.extras.every(
    (extra, index) =>
      extra.id === b.extras[index]?.id && extra.materialId === b.extras[index]?.materialId,
  );
}

export function lineTitle(line: OrderLine): string {
  return `${KIND_LABEL[line.draft.kind]} · ${line.draft.widthMm}×${line.draft.heightMm} мм`;
}

export function lineEquipment(line: OrderLine): string {
  const bits = [
    line.rates.profileName,
    line.draft.profileColor,
    line.draft.method === "area" ? "профиль по площади" : "профиль по элементам",
    line.rates.glassName,
    line.rates.sillName ? `подоконник: ${line.rates.sillName}` : null,
    line.rates.dripName ? `отлив: ${line.rates.dripName}` : null,
    line.rates.mosquitoName ? `сетка: ${line.rates.mosquitoName}` : null,
    line.rates.hardwareName ? `фурнитура: ${line.rates.hardwareName}` : null,
    line.draft.install ? "монтаж" : null,
    ...line.rates.extraLabels.map((extra) => extra.name),
  ];
  return bits.filter(Boolean).join(", ");
}

export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((row) => row.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function deleteCustomerError(
  customerId: string,
  objects: SiteObject[],
  orders: Order[],
): string | null {
  if (orders.some((order) => order.customerId === customerId)) {
    return "Нельзя удалить клиента: есть связанные заказы.";
  }
  if (objects.some((object) => object.customerId === customerId)) {
    return "Нельзя удалить клиента: сначала удалите его объекты.";
  }
  return null;
}

export function deleteObjectError(objectId: string, orders: Order[]): string | null {
  if (orders.some((order) => order.objectId === objectId)) {
    return "Нельзя удалить объект: есть связанные заказы.";
  }
  return null;
}

export function customerFieldError(input: Pick<Customer, "name" | "email">): string | null {
  if (!input.name.trim()) return "Укажите имя или название.";
  if (input.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return "Электронная почта выглядит некорректно.";
  }
  return null;
}

export function objectFieldError(input: Pick<SiteObject, "name" | "customerId">): string | null {
  if (!input.customerId) return "Выберите клиента.";
  if (!input.name.trim()) return "Укажите название объекта.";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function serializeBackup(data: Omit<BackupFile, "version" | "exportedAt">): string {
  const file: BackupFile = { version: 1, exportedAt: nowIso(), ...data };
  return JSON.stringify(file);
}

export function parseBackup(
  raw: string,
): { ok: true; data: BackupFile } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Файл не является JSON." };
  }
  if (!isRecord(parsed) || parsed.version !== 1)
    return { ok: false, error: "Неизвестная версия резервной копии." };
  if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.objects)) {
    return { ok: false, error: "В копии нет списков клиентов и объектов." };
  }
  if (!Array.isArray(parsed.materials) || !Array.isArray(parsed.orders)) {
    return { ok: false, error: "В копии нет прайса или заказов." };
  }
  if (!isRecord(parsed.settings) || typeof parsed.settings.currency !== "string") {
    return { ok: false, error: "В копии нет настроек." };
  }
  const seq = typeof parsed.seq === "number" && parsed.seq >= 0 ? parsed.seq : 0;
  return {
    ok: true,
    data: {
      version: 1,
      exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : nowIso(),
      customers: parsed.customers as Customer[],
      objects: parsed.objects as SiteObject[],
      materials: parsed.materials as Material[],
      orders: parsed.orders as Order[],
      settings: { ...defaultSettings(), ...(parsed.settings as Partial<Settings>) },
      seq,
    },
  };
}
