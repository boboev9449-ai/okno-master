import type {
  CellSpec,
  ConstructionDraft,
  DiscountMode,
  FormulaRow,
  FrozenRates,
  Kind,
  LineCalc,
  Opening,
  OrderTotals,
  ProfileMethod,
  Rounding,
  SizeLimits,
} from "./types.ts";

export function roundMoney(value: number, rounding: Rounding): number {
  if (!Number.isFinite(value)) return 0;
  if (rounding === "10") return Math.round(value / 10) * 10;
  const digits = rounding === "0.01" ? 2 : rounding === "0.1" ? 1 : 0;
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function markupOf(sale: number, cost: number): number | null {
  if (!(cost > 0) || !Number.isFinite(sale) || !Number.isFinite(cost)) return null;
  return (sale - cost) / cost;
}

export function marginOf(sale: number, cost: number): number | null {
  if (!(sale > 0) || !Number.isFinite(sale) || !Number.isFinite(cost)) return null;
  return (sale - cost) / sale;
}

export function validateSize(widthMm: number, heightMm: number, limits: SizeLimits): string | null {
  if (!(widthMm > 0) || !(heightMm > 0)) return "Ширина и высота должны быть больше нуля.";
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) return "Введите числовые размеры.";
  if (widthMm < limits.minWidthMm || heightMm < limits.minHeightMm) {
    return `Размер меньше допустимого (${limits.minWidthMm}×${limits.minHeightMm} мм).`;
  }
  if (widthMm > limits.maxWidthMm || heightMm > limits.maxHeightMm) {
    return `Размер больше допустимого (${limits.maxWidthMm}×${limits.maxHeightMm} мм).`;
  }
  return null;
}

export function validateQty(qty: number): string | null {
  if (!Number.isInteger(qty) || qty < 1) return "Количество — целое число от 1.";
  if (qty > 999) return "Количество не больше 999.";
  return null;
}

function splitMm(total: number, parts: number): number[] {
  const n = Math.max(1, parts);
  const base = Math.floor(total / n);
  const rem = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0));
}

export function defaultOpenings(kind: Kind, customCount = 1): Opening[] {
  switch (kind) {
    case "fixed":
      return ["fixed"];
    case "turn":
    case "single":
    case "balconyDoor":
    case "entranceDoor":
      return ["turn"];
    case "tiltTurn":
      return ["tiltTurn"];
    case "double":
      return ["turn", "tiltTurn"];
    case "triple":
      return ["turn", "fixed", "tiltTurn"];
    case "balconyBlock":
      return ["tiltTurn", "turn"];
    case "sliding":
      return ["sliding", "sliding"];
    case "custom": {
      const n = Math.min(6, Math.max(1, Math.round(customCount)));
      return Array.from({ length: n }, () => "turn" as Opening);
    }
    default:
      return ["turn"];
  }
}

export function buildCells(draft: Pick<ConstructionDraft, "kind" | "widthMm" | "heightMm" | "openings" | "doorWidthMm">): {
  cells: CellSpec[];
  error: string | null;
} {
  const { kind, widthMm, heightMm, openings, doorWidthMm } = draft;
  if (!(widthMm > 0) || !(heightMm > 0) || !Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
    return { cells: [], error: "Ширина и высота должны быть больше нуля." };
  }
  if (kind === "balconyBlock") {
    const door = Math.round(doorWidthMm);
    const win = Math.round(widthMm) - door;
    if (!(door > 0) || !(win > 0)) {
      return { cells: [], error: "Ширина двери должна быть меньше общей ширины. Обе части больше нуля." };
    }
    return {
      error: null,
      cells: [
        { widthMm: win, heightMm: Math.round(heightMm), opening: openings[0] ?? "fixed" },
        { widthMm: door, heightMm: Math.round(heightMm), opening: openings[1] ?? "turn" },
      ],
    };
  }
  const n = Math.max(1, openings.length);
  const widths = splitMm(Math.round(widthMm), n);
  return {
    error: null,
    cells: widths.map((w, i) => ({
      widthMm: w,
      heightMm: Math.round(heightMm),
      opening: openings[i] ?? "fixed",
    })),
  };
}

function fmt(n: number, digits = 3): string {
  const text = n.toFixed(digits).replace(/\.?0+$/, "");
  return text.replace(".", ",");
}

function row(label: string, formula: string, sale: number, cost: number, rounding: Rounding): FormulaRow {
  return { label, formula, sale: roundMoney(sale, rounding), cost: roundMoney(cost, rounding) };
}

export function calcFromParts(input: {
  widthMm: number;
  heightMm: number;
  qty: number;
  method: ProfileMethod;
  cells: CellSpec[];
  rates: FrozenRates;
}): LineCalc {
  const { widthMm, heightMm, qty, method, cells, rates } = input;
  const rounding = rates.rounding;
  const area = (widthMm * heightMm) / 1_000_000;
  const warnings: string[] = [];
  const rows: FormulaRow[] = [];
  let profileLm = 0;

  if (method === "area") {
    const sale = area * rates.profile.salePerM2;
    const cost = area * rates.profile.costPerM2;
    profileLm = 0;
    rows.push(
      row(
        "Профиль (по площади)",
        `${fmt(widthMm / 1000)} м × ${fmt(heightMm / 1000)} м = ${fmt(area)} м² × ${fmt(rates.profile.salePerM2, 2)} за м²`,
        sale,
        cost,
        rounding,
      ),
    );
  } else {
    const frameLm = (2 * (widthMm + heightMm)) / 1000;
    profileLm += frameLm;
    rows.push(
      row(
        "Рама",
        `2 × (${fmt(widthMm / 1000)} + ${fmt(heightMm / 1000)}) = ${fmt(frameLm)} м.п. × ${fmt(rates.profile.salePerLm, 2)}`,
        frameLm * rates.profile.salePerLm,
        frameLm * rates.profile.costPerLm,
        rounding,
      ),
    );
    if (cells.length > 1) {
      const impostLm = (cells.length - 1) * (heightMm / 1000);
      profileLm += impostLm;
      rows.push(
        row(
          `Импосты (${cells.length - 1})`,
          `${cells.length - 1} × ${fmt(heightMm / 1000)} = ${fmt(impostLm)} м.п. × ${fmt(rates.profile.salePerLm, 2)}`,
          impostLm * rates.profile.salePerLm,
          impostLm * rates.profile.costPerLm,
          rounding,
        ),
      );
    }
    const deduction = Math.max(0, rates.deductionMm);
    let sashNo = 0;
    for (const cell of cells) {
      if (cell.opening === "fixed") continue;
      sashNo += 1;
      const sw = Math.max(0, cell.widthMm - deduction);
      const sh = Math.max(0, cell.heightMm - deduction);
      if (sw === 0 || sh === 0) warnings.push(`Вычет ${deduction} мм обнуляет створку ${sashNo}.`);
      const lm = (2 * (sw + sh)) / 1000;
      profileLm += lm;
      const deductNote = deduction > 0 ? `, вычет ${deduction} мм` : "";
      rows.push(
        row(
          `Створка ${sashNo}`,
          `2 × (${fmt(sw / 1000)} + ${fmt(sh / 1000)}) = ${fmt(lm)} м.п.${deductNote} × ${fmt(rates.profile.salePerLm, 2)}`,
          lm * rates.profile.salePerLm,
          lm * rates.profile.costPerLm,
          rounding,
        ),
      );
    }
  }

  let glassRaw = 0;
  let glassBilled = 0;
  if (rates.glass && cells.length > 0) {
    const parts: string[] = [];
    for (const cell of cells) {
      const a = (cell.widthMm * cell.heightMm) / 1_000_000;
      glassRaw += a;
      const billed = Math.max(a, rates.minGlassAreaM2);
      glassBilled += billed;
      parts.push(rates.minGlassAreaM2 > a ? `max(${fmt(a)}, ${fmt(rates.minGlassAreaM2)})` : fmt(a));
    }
    rows.push(
      row(
        "Стеклопакет",
        `${parts.join(" + ")} = ${fmt(glassBilled)} м² × ${fmt(rates.glass.salePerM2, 2)}`,
        glassBilled * rates.glass.salePerM2,
        glassBilled * rates.glass.costPerM2,
        rounding,
      ),
    );
  } else if (cells.length > 0) {
    for (const cell of cells) glassRaw += (cell.widthMm * cell.heightMm) / 1_000_000;
    glassBilled = 0;
  }

  if (rates.sill) {
    const lm = widthMm / 1000;
    rows.push(
      row(
        "Подоконник",
        `${fmt(lm)} м.п. × ${fmt(rates.sill.salePerLm, 2)}`,
        lm * rates.sill.salePerLm,
        lm * rates.sill.costPerLm,
        rounding,
      ),
    );
  }
  if (rates.drip) {
    const lm = widthMm / 1000;
    rows.push(
      row(
        "Отлив",
        `${fmt(lm)} м.п. × ${fmt(rates.drip.salePerLm, 2)}`,
        lm * rates.drip.salePerLm,
        lm * rates.drip.costPerLm,
        rounding,
      ),
    );
  }

  if (rates.mosquito?.mode === "area") {
    const openingArea = cells
      .filter((c) => c.opening !== "fixed")
      .reduce((sum, c) => sum + (c.widthMm * c.heightMm) / 1_000_000, 0);
    const used = openingArea > 0 ? openingArea : area;
    rows.push(
      row(
        "Москитная сетка",
        `${fmt(used)} м² × ${fmt(rates.mosquito.salePerM2, 2)}`,
        used * rates.mosquito.salePerM2,
        used * rates.mosquito.costPerM2,
        rounding,
      ),
    );
  } else if (rates.mosquito?.mode === "piece") {
    const q = Math.max(0, rates.mosquito.qty);
    rows.push(
      row(
        "Москитная сетка",
        `${fmt(q, 0)} шт. × ${fmt(rates.mosquito.sale, 2)}`,
        q * rates.mosquito.sale,
        q * rates.mosquito.cost,
        rounding,
      ),
    );
  }

  if (rates.hardware) {
    const kits = cells.filter((c) => c.opening !== "fixed").length;
    rows.push(
      row(
        "Фурнитура",
        `${kits} компл. × ${fmt(rates.hardware.sale, 2)} (глухие секции не считаются)`,
        kits * rates.hardware.sale,
        kits * rates.hardware.cost,
        rounding,
      ),
    );
  }

  for (const extra of rates.extras) {
    const label = rates.extraLabels.find((l) => l.id === extra.id)?.name ?? "Доп. материал";
    const q = Math.max(0, extra.qty);
    rows.push(row(label, `${fmt(q, 2)} × ${fmt(extra.sale, 2)}`, q * extra.sale, q * extra.cost, rounding));
  }

  if (rates.install) {
    rows.push(
      row(
        "Монтаж",
        `${fmt(area)} м² × ${fmt(rates.install.salePerM2, 2)}`,
        area * rates.install.salePerM2,
        area * rates.install.costPerM2,
        rounding,
      ),
    );
  }

  if (rates.profile.salePerM2 === 0 && rates.profile.salePerLm === 0 && rates.profileName) {
    warnings.push("У профиля нулевая цена — проверьте прайс.");
  }

  const unitSale = roundMoney(
    rows.reduce((sum, r) => sum + r.sale, 0),
    rounding,
  );
  const unitCost = roundMoney(
    rows.reduce((sum, r) => sum + r.cost, 0),
    rounding,
  );
  const safeQty = Number.isFinite(qty) ? qty : 0;
  const sale = roundMoney(unitSale * safeQty, rounding);
  const cost = roundMoney(unitCost * safeQty, rounding);
  const profit = roundMoney(sale - cost, rounding);

  return {
    areaM2: area,
    profileLm,
    glassRawM2: glassRaw,
    glassBilledM2: glassBilled,
    rows,
    unitSale,
    unitCost,
    sale,
    cost,
    profit,
    markup: markupOf(sale, cost),
    margin: marginOf(sale, cost),
    warnings,
  };
}

export function computeTotals(
  lines: { sale: number; cost: number }[],
  discountMode: DiscountMode,
  discountValue: number,
  extraSale: number,
  extraCost: number,
  rounding: Rounding,
): OrderTotals {
  const subtotalSale = roundMoney(
    lines.reduce((sum, line) => sum + line.sale, 0),
    rounding,
  );
  const subtotalCost = roundMoney(
    lines.reduce((sum, line) => sum + line.cost, 0),
    rounding,
  );
  const rawDiscount =
    discountMode === "percent"
      ? subtotalSale * (Math.max(0, discountValue) / 100)
      : Math.max(0, discountValue);
  const discount = roundMoney(Math.min(subtotalSale, rawDiscount), rounding);
  const extraS = roundMoney(Math.max(0, extraSale), rounding);
  const extraC = roundMoney(Math.max(0, extraCost), rounding);
  const sale = roundMoney(subtotalSale - discount + extraS, rounding);
  const cost = roundMoney(subtotalCost + extraC, rounding);
  const profit = roundMoney(sale - cost, rounding);
  return {
    subtotalSale,
    subtotalCost,
    discount,
    extraSale: extraS,
    extraCost: extraC,
    sale,
    cost,
    profit,
    markup: markupOf(sale, cost),
    margin: marginOf(sale, cost),
  };
}
