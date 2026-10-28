export type Opening = "fixed" | "turn" | "tilt" | "tiltTurn" | "sliding";

export type Kind =
  | "single"
  | "double"
  | "triple"
  | "fixed"
  | "turn"
  | "tiltTurn"
  | "balconyBlock"
  | "balconyDoor"
  | "entranceDoor"
  | "sliding"
  | "custom";

export type ProfileMethod = "area" | "elements";

export type Rounding = "0.01" | "0.1" | "1" | "10";

export type MaterialCategory =
  | "profile"
  | "glass"
  | "hardware"
  | "sill"
  | "drip"
  | "mosquito"
  | "seal"
  | "consumable"
  | "install"
  | "service";

export type Unit = "m2" | "lm" | "pcs" | "set";

export type OrderStatus =
  | "draft"
  | "calculated"
  | "awaiting"
  | "confirmed"
  | "production"
  | "ready"
  | "delivered"
  | "installed"
  | "cancelled";

export type DiscountMode = "percent" | "amount";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  comment: string;
  createdAt: string;
}

export interface SiteObject {
  id: string;
  customerId: string;
  name: string;
  address: string;
  measureDate: string;
  comment: string;
  createdAt: string;
}

export interface Material {
  id: string;
  category: MaterialCategory;
  name: string;
  manufacturer: string;
  sku: string;
  unit: Unit;
  costPrice: number;
  salePrice: number;
  costPerM2: number;
  salePerM2: number;
  costPerLm: number;
  salePerLm: number;
  description: string;
}

export interface ExtraDraft {
  id: string;
  materialId: string;
  qty: number;
}

export interface ConstructionDraft {
  id: string;
  kind: Kind;
  widthMm: number;
  heightMm: number;
  qty: number;
  profileId: string;
  profileColor: string;
  openings: Opening[];
  doorWidthMm: number;
  method: ProfileMethod;
  glassId: string;
  sillId: string;
  dripId: string;
  mosquitoMode: "none" | "area" | "piece";
  mosquitoId: string;
  mosquitoPieces: number;
  hardwareId: string;
  install: boolean;
  extras: ExtraDraft[];
}

export interface CellSpec {
  widthMm: number;
  heightMm: number;
  opening: Opening;
}

export interface FormulaRow {
  label: string;
  formula: string;
  sale: number;
  cost: number;
}

export interface LineCalc {
  areaM2: number;
  profileLm: number;
  glassRawM2: number;
  glassBilledM2: number;
  rows: FormulaRow[];
  unitSale: number;
  unitCost: number;
  sale: number;
  cost: number;
  profit: number;
  markup: number | null;
  margin: number | null;
  warnings: string[];
}

export interface RateProfile {
  salePerM2: number;
  costPerM2: number;
  salePerLm: number;
  costPerLm: number;
}

export interface FrozenRates {
  profileName: string;
  glassName: string | null;
  sillName: string | null;
  dripName: string | null;
  mosquitoName: string | null;
  hardwareName: string | null;
  extraLabels: { id: string; name: string; unit: Unit }[];
  profile: RateProfile;
  glass: { salePerM2: number; costPerM2: number } | null;
  sill: { salePerLm: number; costPerLm: number } | null;
  drip: { salePerLm: number; costPerLm: number } | null;
  mosquito:
    | null
    | { mode: "area"; salePerM2: number; costPerM2: number }
    | { mode: "piece"; sale: number; cost: number; qty: number };
  hardware: { sale: number; cost: number } | null;
  extras: { id: string; sale: number; cost: number; qty: number }[];
  install: { salePerM2: number; costPerM2: number } | null;
  deductionMm: number;
  rounding: Rounding;
  minGlassAreaM2: number;
}

export interface OrderLine {
  id: string;
  draft: ConstructionDraft;
  rates: FrozenRates;
  cells: CellSpec[];
  calc: LineCalc;
}

export interface OrderTotals {
  subtotalSale: number;
  subtotalCost: number;
  discount: number;
  extraSale: number;
  extraCost: number;
  sale: number;
  cost: number;
  profit: number;
  markup: number | null;
  margin: number | null;
}

export interface Order {
  id: string;
  number: string;
  customerId: string;
  objectId: string;
  date: string;
  lines: OrderLine[];
  discountMode: DiscountMode;
  discountValue: number;
  extraSale: number;
  extraCost: number;
  comment: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  totals: OrderTotals;
}

export interface Settings {
  companyName: string;
  phone: string;
  address: string;
  email: string;
  logoDataUrl: string | null;
  currency: string;
  rounding: Rounding;
  minGlassAreaM2: number;
  installSalePerM2: number;
  installCostPerM2: number;
  defaultMarkupPercent: number;
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
  profileDeductionMm: number;
  defaultMethod: ProfileMethod;
  theme: "light" | "dark";
}

export interface SizeLimits {
  minWidthMm: number;
  maxWidthMm: number;
  minHeightMm: number;
  maxHeightMm: number;
}

export interface BackupFile {
  version: 1;
  exportedAt: string;
  customers: Customer[];
  objects: SiteObject[];
  materials: Material[];
  orders: Order[];
  settings: Settings;
  seq: number;
}
