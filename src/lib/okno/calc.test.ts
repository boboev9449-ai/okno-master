import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildCells,
  calcFromParts,
  computeTotals,
  marginOf,
  markupOf,
  roundMoney,
  validateQty,
  validateSize,
} from "./calc.ts";
import {
  deleteCustomerError,
  parseBackup,
  priceLine,
  resolveRates,
  seedMaterials,
  serializeBackup,
  upsertById,
  defaultSettings,
  blankDraft,
  uid,
} from "./domain.ts";
import { pdfWithCyrillic } from "./pdf-text.ts";
import type { Customer, FrozenRates, Order, SiteObject } from "./types.ts";

const limits = { minWidthMm: 300, maxWidthMm: 6000, minHeightMm: 300, maxHeightMm: 6000 };

describe("идентификаторы", () => {
  it("создаёт UUID, если randomUUID недоступен", () => {
    const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, "crypto");
    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues(bytes: Uint8Array) {
          bytes.fill(0);
          return bytes;
        },
      },
    });

    try {
      assert.match(uid(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, "crypto", originalCrypto);
      } else {
        Reflect.deleteProperty(globalThis, "crypto");
      }
    }
  });
});

function rates(partial: Partial<FrozenRates> = {}): FrozenRates {
  return {
    profileName: "Профиль",
    glassName: null,
    sillName: null,
    dripName: null,
    mosquitoName: null,
    hardwareName: null,
    extraLabels: [],
    profile: { salePerM2: 0, costPerM2: 0, salePerLm: 0, costPerLm: 0 },
    glass: null,
    sill: null,
    drip: null,
    mosquito: null,
    hardware: null,
    extras: [],
    install: null,
    deductionMm: 0,
    rounding: "0.01",
    minGlassAreaM2: 0,
    ...partial,
  };
}

describe("площадь и профиль", () => {
  it("считает площадь 1000×1000 как 1 м²", () => {
    const calc = calcFromParts({
      widthMm: 1000,
      heightMm: 1000,
      qty: 1,
      method: "area",
      cells: [{ widthMm: 1000, heightMm: 1000, opening: "fixed" }],
      rates: rates({ profile: { salePerM2: 100, costPerM2: 70, salePerLm: 0, costPerLm: 0 } }),
    });
    assert.equal(calc.areaM2, 1);
    assert.equal(calc.sale, 100);
    assert.equal(calc.cost, 70);
  });

  it("метод по площади не подменяет погонные метры", () => {
    const calc = calcFromParts({
      widthMm: 1200,
      heightMm: 1400,
      qty: 1,
      method: "area",
      cells: [{ widthMm: 1200, heightMm: 1400, opening: "fixed" }],
      rates: rates({
        profile: { salePerM2: 100, costPerM2: 70, salePerLm: 999, costPerLm: 999 },
        glass: { salePerM2: 50, costPerM2: 30 },
        glassName: "СП",
      }),
    });
    assert.equal(calc.areaM2, 1.68);
    assert.equal(calc.profileLm, 0);
    assert.equal(calc.rows[0]?.sale, 168);
    assert.equal(calc.rows[1]?.sale, 84);
    assert.equal(calc.sale, 252);
    assert.equal(calc.cost, 168);
  });

  it("метод по элементам считает раму, импост и створки отдельно", () => {
    const single = calcFromParts({
      widthMm: 1000,
      heightMm: 1000,
      qty: 1,
      method: "elements",
      cells: [{ widthMm: 1000, heightMm: 1000, opening: "turn" }],
      rates: rates({ profile: { salePerM2: 999, costPerM2: 999, salePerLm: 10, costPerLm: 5 } }),
    });
    assert.equal(single.profileLm, 8);
    assert.equal(single.sale, 80);
    assert.equal(single.cost, 40);

    const cells = buildCells({
      kind: "double",
      widthMm: 2000,
      heightMm: 1000,
      openings: ["turn", "turn"],
      doorWidthMm: 700,
    });
    const double = calcFromParts({
      widthMm: 2000,
      heightMm: 1000,
      qty: 1,
      method: "elements",
      cells: cells.cells,
      rates: rates({ profile: { salePerM2: 0, costPerM2: 0, salePerLm: 10, costPerLm: 5 } }),
    });
    assert.equal(cells.cells.length, 2);
    assert.equal(double.profileLm, 15);
    assert.equal(double.sale, 150);
  });

  it("глухая секция не добавляет створочный профиль и фурнитуру", () => {
    const calc = calcFromParts({
      widthMm: 1000,
      heightMm: 1000,
      qty: 2,
      method: "elements",
      cells: [{ widthMm: 1000, heightMm: 1000, opening: "fixed" }],
      rates: rates({
        profile: { salePerM2: 0, costPerM2: 0, salePerLm: 10, costPerLm: 5 },
        hardware: { sale: 80, cost: 50 },
        hardwareName: "Фурнитура",
      }),
    });
    assert.equal(calc.profileLm, 4);
    assert.equal(calc.rows.find((row) => row.label === "Фурнитура")?.sale, 0);
    assert.equal(calc.unitSale, 40);
    assert.equal(calc.sale, 80);
  });
});

describe("стеклопакет и комплектующие", () => {
  it("применяет минимальную площадь к каждой секции", () => {
    const one = calcFromParts({
      widthMm: 400,
      heightMm: 500,
      qty: 1,
      method: "area",
      cells: [{ widthMm: 400, heightMm: 500, opening: "fixed" }],
      rates: rates({
        profile: { salePerM2: 0, costPerM2: 0, salePerLm: 0, costPerLm: 0 },
        glass: { salePerM2: 100, costPerM2: 40 },
        glassName: "СП",
        minGlassAreaM2: 0.5,
      }),
    });
    assert.equal(one.glassRawM2, 0.2);
    assert.equal(one.glassBilledM2, 0.5);
    assert.equal(one.rows.find((row) => row.label === "Стеклопакет")?.sale, 50);

    const two = calcFromParts({
      widthMm: 800,
      heightMm: 500,
      qty: 1,
      method: "area",
      cells: [
        { widthMm: 400, heightMm: 500, opening: "fixed" },
        { widthMm: 400, heightMm: 500, opening: "fixed" },
      ],
      rates: rates({
        profile: { salePerM2: 0, costPerM2: 0, salePerLm: 0, costPerLm: 0 },
        glass: { salePerM2: 100, costPerM2: 40 },
        minGlassAreaM2: 0.5,
      }),
    });
    assert.equal(two.glassBilledM2, 1);
    assert.equal(two.rows.find((row) => row.label === "Стеклопакет")?.sale, 100);
  });

  it("считает подоконник, отлив, сетку и фурнитуру своими единицами", () => {
    const calc = calcFromParts({
      widthMm: 1500,
      heightMm: 1000,
      qty: 1,
      method: "elements",
      cells: [
        { widthMm: 750, heightMm: 1000, opening: "turn" },
        { widthMm: 750, heightMm: 1000, opening: "tiltTurn" },
      ],
      rates: rates({
        profile: { salePerM2: 0, costPerM2: 0, salePerLm: 0, costPerLm: 0 },
        sill: { salePerLm: 40, costPerLm: 20 },
        sillName: "Подоконник",
        drip: { salePerLm: 10, costPerLm: 4 },
        dripName: "Отлив",
        mosquito: { mode: "piece", sale: 120, cost: 60, qty: 2 },
        mosquitoName: "Сетка",
        hardware: { sale: 80, cost: 50 },
        hardwareName: "Фурнитура",
        install: { salePerM2: 70, costPerM2: 35 },
      }),
    });
    assert.equal(calc.rows.find((row) => row.label === "Подоконник")?.sale, 60);
    assert.equal(calc.rows.find((row) => row.label === "Подоконник")?.cost, 30);
    assert.equal(calc.rows.find((row) => row.label === "Отлив")?.sale, 15);
    assert.equal(calc.rows.find((row) => row.label === "Москитная сетка")?.sale, 240);
    assert.equal(calc.rows.find((row) => row.label === "Фурнитура")?.sale, 160);
    assert.equal(calc.rows.find((row) => row.label === "Монтаж")?.sale, 105);
  });
});

describe("скидка, наценка и маржа", () => {
  it("не путает наценку и маржу", () => {
    assert.equal(markupOf(200, 100), 1);
    assert.equal(marginOf(200, 100), 0.5);
    assert.notEqual(markupOf(200, 100), marginOf(200, 100));
    assert.equal(markupOf(0, 0), null);
    assert.equal(marginOf(0, 100), null);
  });

  it("считает итог как сумма − скидка + доп. расходы", () => {
    const totals = computeTotals([{ sale: 1000, cost: 400 }], "percent", 10, 50, 20, "0.01");
    assert.equal(totals.discount, 100);
    assert.equal(totals.sale, 950);
    assert.equal(totals.cost, 420);
    assert.equal(totals.profit, 530);
  });

  it("не даёт скидке превысить сумму позиций", () => {
    const totals = computeTotals([{ sale: 80, cost: 10 }], "amount", 500, 0, 0, "0.01");
    assert.equal(totals.discount, 80);
    assert.equal(totals.sale, 0);
  });

  it("округляет деньги по шагу", () => {
    assert.equal(roundMoney(486, "10"), 490);
    assert.equal(roundMoney(14, "10"), 10);
    assert.equal(roundMoney(10.126, "0.01"), 10.13);
  });
});

describe("размеры и схема", () => {
  it("отклоняет неположительные и вне пределов размеры", () => {
    assert.match(validateSize(0, 1000, limits) ?? "", /больше нуля/);
    assert.match(validateSize(-5, 1000, limits) ?? "", /больше нуля/);
    assert.match(validateSize(200, 1000, limits) ?? "", /меньше/);
    assert.match(validateSize(7000, 1000, limits) ?? "", /больше допустимого/);
    assert.equal(validateSize(1400, 1400, limits), null);
    assert.match(validateQty(0) ?? "", /целое/);
    assert.match(validateQty(1.5) ?? "", /целое/);
    assert.equal(validateQty(2), null);
  });

  it("делит балконный блок на окно и дверь", () => {
    const built = buildCells({
      kind: "balconyBlock",
      widthMm: 2000,
      heightMm: 2100,
      openings: ["tiltTurn", "turn"],
      doorWidthMm: 700,
    });
    assert.equal(built.error, null);
    assert.deepEqual(
      built.cells.map((cell) => cell.widthMm),
      [1300, 700],
    );
    const bad = buildCells({
      kind: "balconyBlock",
      widthMm: 600,
      heightMm: 2100,
      openings: ["fixed", "turn"],
      doorWidthMm: 700,
    });
    assert.ok(bad.error);
  });
});

describe("клиенты, заказы и исторические цены", () => {
  it("сохраняет клиента по идентификатору без дубля", () => {
    const first: Customer = {
      id: "c1",
      name: "Алиев А.",
      phone: "",
      email: "",
      address: "",
      comment: "",
      createdAt: "2026-01-01",
    };
    const once = upsertById([], first);
    const twice = upsertById(once, { ...first, phone: "900" });
    assert.equal(twice.length, 1);
    assert.equal(twice[0]?.phone, "900");
  });

  it("не удаляет клиента с заказами", () => {
    const objects: SiteObject[] = [];
    const orders = [{ customerId: "c1", objectId: "o1" } as Order];
    assert.match(deleteCustomerError("c1", objects, orders) ?? "", /заказы/);
    assert.equal(deleteCustomerError("c2", objects, orders), null);
  });

  it("сохраняет цены заказа после изменения прайса", () => {
    const materials = seedMaterials();
    const settings = defaultSettings();
    const draft = blankDraft(settings, materials);
    draft.method = "area";
    draft.widthMm = 1000;
    draft.heightMm = 1000;
    draft.kind = "fixed";
    draft.openings = ["fixed"];
    draft.glassId = "";
    const frozen = resolveRates(draft, materials, settings);
    const before = frozen.profile.salePerM2;
    const profile = materials.find((material) => material.id === draft.profileId);
    assert.ok(profile);
    profile.salePerM2 = 9999;
    assert.equal(frozen.profile.salePerM2, before);
    const line = priceLine(draft, frozen);
    assert.ok(!("error" in line));
    if (!("error" in line)) {
      assert.equal(line.calc.sale, before);
      assert.equal(line.rates.profile.salePerM2, before);
    }
  });

  it("крутит резервную копию туда и обратно", () => {
    const settings = defaultSettings();
    const raw = serializeBackup({
      customers: [],
      objects: [],
      materials: seedMaterials(),
      orders: [],
      settings,
      seq: 4,
    });
    const parsed = parseBackup(raw);
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.data.seq, 4);
      assert.equal(parsed.data.materials.length > 0, true);
      assert.equal(parsed.data.settings.currency, "TJS");
    }
    const bad = parseBackup("{");
    assert.equal(bad.ok, false);
  });
});

describe("PDF", () => {
  it("встраивает кириллицу в PDF", async () => {
    const fontBytes = new Uint8Array(
      readFileSync("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    );
    const bytes = await pdfWithCyrillic(fontBytes, "Коммерческое предложение № 12 — стеклопакет");
    assert.ok(bytes.length > 1000);
    assert.ok(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46);
  });
});
