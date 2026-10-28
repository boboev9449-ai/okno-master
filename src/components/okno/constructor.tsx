import { buildCells, calcFromParts, validateQty, validateSize } from "@/lib/okno/calc";
import { KIND_LABEL, OPENING_LABEL, resolveRates, uid, withKind, withSashCount } from "@/lib/okno/domain";
import { money, percent } from "@/lib/okno/format";
import { useOkno } from "@/lib/okno/store";
import type { ConstructionDraft, FrozenRates, Kind, Opening } from "@/lib/okno/types";
import { Schematic } from "@/components/okno/schematic";
import { Button, Field, NumberInput, Select, TextInput } from "@/components/okno/ui";

const kinds = Object.keys(KIND_LABEL) as Kind[];
const openings = Object.keys(OPENING_LABEL) as Opening[];

export function Constructor({
  draft,
  frozen,
  currency,
  onChange,
  onUseCurrentPrices,
  onApply,
  onCancel,
  applyLabel,
}: {
  draft: ConstructionDraft;
  frozen: FrozenRates | null;
  currency: string;
  onChange: (draft: ConstructionDraft) => void;
  onUseCurrentPrices: () => void;
  onApply: (error: string | null) => void;
  onCancel?: () => void;
  applyLabel: string;
}) {
  const materials = useOkno((state) => state.materials);
  const settings = useOkno((state) => state.settings);
  const rates = frozen ?? resolveRates(draft, materials, settings);
  const built = buildCells(draft);
  const sizeError = validateSize(draft.widthMm, draft.heightMm, settings);
  const qtyError = validateQty(draft.qty);
  const calc =
    built.error || sizeError
      ? null
      : calcFromParts({
          widthMm: draft.widthMm,
          heightMm: draft.heightMm,
          qty: draft.qty,
          method: draft.method,
          cells: built.cells,
          rates,
        });
  const profiles = materials.filter((material) => material.category === "profile");
  const glasses = materials.filter((material) => material.category === "glass");
  const sills = materials.filter((material) => material.category === "sill");
  const drips = materials.filter((material) => material.category === "drip");
  const nets = materials.filter((material) => material.category === "mosquito");
  const hardware = materials.filter((material) => material.category === "hardware");

  const set = (patch: Partial<ConstructionDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Тип конструкции">
            <Select
              value={draft.kind}
              onChange={(event) => onChange(withKind(draft, event.target.value as Kind))}
            >
              {kinds.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Цвет профиля">
            <TextInput
              list="profile-colors"
              value={draft.profileColor}
              onChange={(event) => set({ profileColor: event.target.value })}
            />
            <datalist id="profile-colors">
              <option value="Белый" />
              <option value="Антрацит" />
              <option value="Золотой дуб" />
              <option value="Орех" />
              <option value="Тёмно-коричневый" />
            </datalist>
          </Field>
          <Field label="Ширина, мм" error={sizeError}>
            <NumberInput value={draft.widthMm} onChange={(widthMm) => set({ widthMm })} min={1} />
          </Field>
          <Field label="Высота, мм">
            <NumberInput value={draft.heightMm} onChange={(heightMm) => set({ heightMm })} min={1} />
          </Field>
          <Field label="Количество" error={qtyError}>
            <NumberInput value={draft.qty} onChange={(qty) => set({ qty })} min={1} />
          </Field>
          {draft.kind === "custom" ? (
            <Field label="Число секций" hint="От 1 до 6. Ширина делится поровну.">
              <NumberInput
                value={draft.openings.length}
                onChange={(count) => onChange(withSashCount(draft, count))}
                min={1}
                max={6}
              />
            </Field>
          ) : null}
          {draft.kind === "balconyBlock" ? (
            <Field label="Ширина двери, мм" error={built.error} hint="Остаток ширины — оконная часть.">
              <NumberInput value={draft.doorWidthMm} onChange={(doorWidthMm) => set({ doorWidthMm })} min={1} />
            </Field>
          ) : null}
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted">Секции и открывание</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(built.cells.length ? built.cells : draft.openings.map((opening) => ({ opening }))).map((cell, index) => (
              <Field key={index} label={`Секция ${index + 1}${ "widthMm" in cell ? `, ${cell.widthMm} мм` : ""}`}>
                <Select
                  value={draft.openings[index] ?? "fixed"}
                  onChange={(event) => {
                    const next = draft.openings.slice();
                    next[index] = event.target.value as Opening;
                    set({ openings: next });
                  }}
                >
                  {openings.map((opening) => (
                    <option key={opening} value={opening}>
                      {OPENING_LABEL[opening]}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Профиль">
            <Select value={draft.profileId} onChange={(event) => set({ profileId: event.target.value })}>
              <option value="">Не выбран</option>
              {profiles.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Метод расчёта профиля">
            <Select
              value={draft.method}
              onChange={(event) => set({ method: event.target.value as ConstructionDraft["method"] })}
            >
              <option value="elements">По элементам, м.п.</option>
              <option value="area">По площади, м²</option>
            </Select>
          </Field>
          <Field label="Стеклопакет">
            <Select value={draft.glassId} onChange={(event) => set({ glassId: event.target.value })}>
              <option value="">Без стеклопакета</option>
              {glasses.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Фурнитура" hint="Комплект на каждую открывающуюся секцию.">
            <Select value={draft.hardwareId} onChange={(event) => set({ hardwareId: event.target.value })}>
              <option value="">Без фурнитуры</option>
              {hardware.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Подоконник">
            <Select value={draft.sillId} onChange={(event) => set({ sillId: event.target.value })}>
              <option value="">Нет</option>
              {sills.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Отлив">
            <Select value={draft.dripId} onChange={(event) => set({ dripId: event.target.value })}>
              <option value="">Нет</option>
              {drips.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Москитная сетка">
            <Select
              value={draft.mosquitoMode}
              onChange={(event) => set({ mosquitoMode: event.target.value as ConstructionDraft["mosquitoMode"] })}
            >
              <option value="none">Нет</option>
              <option value="area">По площади открывающихся секций</option>
              <option value="piece">По штукам</option>
            </Select>
          </Field>
          {draft.mosquitoMode !== "none" ? (
            <Field label="Позиция сетки">
              <Select value={draft.mosquitoId} onChange={(event) => set({ mosquitoId: event.target.value })}>
                <option value="">Не выбрана</option>
                {nets.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          {draft.mosquitoMode === "piece" ? (
            <Field label="Сеток, шт.">
              <NumberInput value={draft.mosquitoPieces} onChange={(mosquitoPieces) => set({ mosquitoPieces })} min={0} />
            </Field>
          ) : null}
        </div>

        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={draft.install}
            onChange={(event) => set({ install: event.target.checked })}
          />
          Монтаж по тарифу из настроек ({money(settings.installSalePerM2, currency)} / м²)
        </label>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted">Дополнительные материалы</p>
            <Button
              variant="ghost"
              onClick={() =>
                set({ extras: [...draft.extras, { id: uid(), materialId: materials[0]?.id ?? "", qty: 1 }] })
              }
            >
              Добавить
            </Button>
          </div>
          {draft.extras.map((extra) => (
            <div key={extra.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto]">
              <Select
                value={extra.materialId}
                onChange={(event) =>
                  set({
                    extras: draft.extras.map((row) =>
                      row.id === extra.id ? { ...row, materialId: event.target.value } : row,
                    ),
                  })
                }
              >
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.name}
                  </option>
                ))}
              </Select>
              <NumberInput
                value={extra.qty}
                onChange={(qty) =>
                  set({ extras: draft.extras.map((row) => (row.id === extra.id ? { ...row, qty } : row)) })
                }
              />
              <Button
                variant="danger"
                onClick={() => set({ extras: draft.extras.filter((row) => row.id !== extra.id) })}
              >
                Убрать
              </Button>
            </div>
          ))}
        </div>
      </div>

      <aside className="grid h-fit gap-3 rounded-xl border border-line bg-bg p-4 lg:sticky lg:top-4">
        <Schematic cells={built.cells} widthMm={draft.widthMm} heightMm={draft.heightMm} />
        {frozen ? (
          <p className="text-xs text-muted">Цены зафиксированы на момент позиции. Прайс после этого не меняет строку.</p>
        ) : (
          <p className="text-xs text-muted">Цены берутся из текущего прайса и будут сохранены в заказе.</p>
        )}
        {frozen ? (
          <Button variant="ghost" onClick={onUseCurrentPrices}>
            Пересчитать по текущему прайсу
          </Button>
        ) : null}
        <dl className="grid gap-2 text-sm">
          {calc?.rows.map((formula) => (
            <div key={formula.label + formula.formula} className="grid gap-0.5 border-b border-line pb-2">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="font-medium">{formula.label}</dt>
                <dd className="tabular shrink-0">{money(formula.sale, currency)}</dd>
              </div>
              <dd className="text-xs leading-5 text-muted">{formula.formula}</dd>
            </div>
          ))}
        </dl>
        {calc ? (
          <div className="grid gap-1 text-sm">
            <Row label="За 1 шт." value={money(calc.unitSale, currency)} />
            <Row label="Себестоимость" value={money(calc.cost, currency)} />
            <Row label="Наценка" value={percent(calc.markup)} />
            <Row label="Маржа" value={percent(calc.margin)} />
            <Row label="Прибыль" value={money(calc.profit, currency)} />
            <p className="pt-1 text-base font-semibold tabular">Итого {money(calc.sale, currency)}</p>
            {calc.warnings.map((warning) => (
              <p key={warning} className="text-xs text-danger">
                {warning}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-danger">{sizeError || built.error}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              if (!draft.profileId) {
                onApply("Выберите профиль.");
                return;
              }
              if (sizeError || qtyError || built.error) {
                onApply(sizeError || qtyError || built.error);
                return;
              }
              onApply(null);
            }}
          >
            {applyLabel}
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Закрыть
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted">{label}</span>
      <span className="tabular">{value}</span>
    </div>
  );
}
