import { useMemo, useState } from "react";
import { blankMaterial, CATEGORIES, CATEGORY_LABEL, normalizeMaterial, UNIT_LABEL } from "@/lib/okno/domain";
import { money } from "@/lib/okno/format";
import { useOkno } from "@/lib/okno/store";
import type { Material, MaterialCategory, Unit } from "@/lib/okno/types";
import { Shell, useReady } from "@/components/okno/shell";
import { Button, Card, Empty, Field, Modal, NumberInput, PageTitle, Select, TextArea, TextInput } from "@/components/okno/ui";

const units: Unit[] = ["m2", "lm", "pcs", "set"];

export function MaterialsPage() {
  return (
    <Shell>
      <MaterialsBody />
    </Shell>
  );
}

function MaterialsBody() {
  const ready = useReady();
  const materials = useOkno((state) => state.materials);
  const currency = useOkno((state) => state.settings.currency);
  const saveMaterial = useOkno((state) => state.saveMaterial);
  const deleteMaterial = useOkno((state) => state.deleteMaterial);
  const restoreSeedMaterials = useOkno((state) => state.restoreSeedMaterials);
  const setNotice = useOkno((state) => state.setNotice);
  const markup = useOkno((state) => state.settings.defaultMarkupPercent);
  const [category, setCategory] = useState<MaterialCategory>("profile");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"name" | "sale">("name");
  const [editing, setEditing] = useState<Material | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [restore, setRestore] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials
      .filter((material) => material.category === category)
      .filter((material) => !q || [material.name, material.sku, material.manufacturer].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name, "ru") : b.salePrice - a.salePrice));
  }, [materials, category, query, sort]);

  return (
    <>
      <PageTitle
        title="Прайс"
        text="Стартовые цены не являются рыночными. Меняйте их здесь — сохранённые заказы останутся со старыми ценами."
      />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setCategory(item)}
            className={`h-11 shrink-0 rounded-md px-3 text-sm font-medium ${category === item ? "bg-navy text-on-navy" : "border border-line bg-surface text-muted"}`}
          >
            {CATEGORY_LABEL[item]}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" aria-label="Поиск материалов" className="max-w-xs" />
        <Select value={sort} onChange={(event) => setSort(event.target.value as "name" | "sale")} className="max-w-48">
          <option value="name">По названию</option>
          <option value="sale">По цене продажи</option>
        </Select>
        <Button onClick={() => setEditing(blankMaterial(category))}>Новый материал</Button>
        <Button variant="ghost" onClick={() => setRestore(true)}>
          Вернуть стартовый прайс
        </Button>
      </div>
      {!ready ? <p className="text-sm text-muted">Загрузка данных…</p> : null}
      {ready && rows.length === 0 ? <Empty title="В категории пусто" text="Добавьте материал — калькулятор сразу начнёт его предлагать." /> : null}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-bg text-left text-muted">
            <tr>
              <th className="px-3 py-3 font-medium">Название</th>
              <th className="px-3 py-3 font-medium">Артикул</th>
              <th className="px-3 py-3 font-medium">Ед.</th>
              <th className="px-3 py-3 font-medium">Закупка</th>
              <th className="px-3 py-3 font-medium">Продажа</th>
            </tr>
          </thead>
          <tbody>
            {ready
              ? rows.map((material) => (
                  <tr key={material.id} className="border-t border-line bg-surface">
                    <td className="px-3 py-3">
                      <button type="button" className="text-left font-medium" onClick={() => setEditing(material)}>
                        {material.name}
                      </button>
                      <span className="block text-xs text-faint">{material.manufacturer}</span>
                    </td>
                    <td className="px-3 py-3 text-muted">{material.sku || "—"}</td>
                    <td className="px-3 py-3">{UNIT_LABEL[material.unit]}</td>
                    <td className="px-3 py-3 tabular">{money(material.costPrice, currency)}</td>
                    <td className="px-3 py-3 tabular">{money(material.salePrice, currency)}</td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>
      <Modal open={Boolean(editing)} title={editing?.name ? "Материал" : "Новый материал"} onClose={() => setEditing(null)}>
        {editing ? (
          <MaterialForm
            initial={editing}
            markup={markup}
            onCancel={() => setEditing(null)}
            onDelete={() => setConfirmId(editing.id)}
            onSave={(material) => {
              if (!material.name.trim()) {
                setNotice("Укажите название материала.");
                return;
              }
              saveMaterial(material);
              setNotice("Материал сохранён.");
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>
      <Modal open={Boolean(confirmId)} title="Удалить материал?" onClose={() => setConfirmId(null)}>
        <p className="mb-4 text-sm text-muted">Старые заказы сохранят название и цену, которые были на момент расчёта.</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (confirmId) deleteMaterial(confirmId);
              setConfirmId(null);
              setEditing(null);
            }}
          >
            Удалить
          </Button>
          <Button variant="ghost" onClick={() => setConfirmId(null)}>
            Отмена
          </Button>
        </div>
      </Modal>
      <Modal open={restore} title="Заменить прайс стартовым?" onClose={() => setRestore(false)}>
        <p className="mb-4 text-sm text-muted">Текущие материалы будут заменены. Заказы не изменятся.</p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              restoreSeedMaterials();
              setRestore(false);
              setNotice("Стартовый прайс восстановлен.");
            }}
          >
            Заменить
          </Button>
          <Button variant="ghost" onClick={() => setRestore(false)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </>
  );
}

function MaterialForm({
  initial,
  markup,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: Material;
  markup: number;
  onSave: (material: Material) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState(initial);
  const profile = form.category === "profile";
  const applyMarkup = () => {
    const factor = 1 + markup / 100;
    if (profile) {
      setForm({ ...form, salePerM2: round2(form.costPerM2 * factor), salePerLm: round2(form.costPerLm * factor) });
      return;
    }
    setForm({ ...form, salePrice: round2(form.costPrice * factor) });
  };
  return (
    <div className="grid gap-3">
      <Field label="Категория">
        <Select
          value={form.category}
          onChange={(event) => setForm(normalizeMaterial({ ...form, category: event.target.value as MaterialCategory }))}
        >
          {CATEGORIES.map((item) => (
            <option key={item} value={item}>
              {CATEGORY_LABEL[item]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Название">
        <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Производитель">
          <TextInput value={form.manufacturer} onChange={(event) => setForm({ ...form, manufacturer: event.target.value })} />
        </Field>
        <Field label="Артикул">
          <TextInput value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} />
        </Field>
      </div>
      {profile ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Себестоимость за м²">
            <NumberInput value={form.costPerM2} onChange={(costPerM2) => setForm({ ...form, costPerM2 })} />
          </Field>
          <Field label="Продажа за м²">
            <NumberInput value={form.salePerM2} onChange={(salePerM2) => setForm({ ...form, salePerM2 })} />
          </Field>
          <Field label="Себестоимость за м.п.">
            <NumberInput value={form.costPerLm} onChange={(costPerLm) => setForm({ ...form, costPerLm })} />
          </Field>
          <Field label="Продажа за м.п.">
            <NumberInput value={form.salePerLm} onChange={(salePerLm) => setForm({ ...form, salePerLm })} />
          </Field>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Единица">
            <Select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as Unit })}>
              {units.map((unit) => (
                <option key={unit} value={unit}>
                  {UNIT_LABEL[unit]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Закупочная цена">
            <NumberInput value={form.costPrice} onChange={(costPrice) => setForm({ ...form, costPrice })} />
          </Field>
          <Field label="Цена продажи">
            <NumberInput value={form.salePrice} onChange={(salePrice) => setForm({ ...form, salePrice })} />
          </Field>
        </div>
      )}
      <Button variant="ghost" onClick={applyMarkup}>
        Цена продажи = себестоимость + наценка {markup}%
      </Button>
      <Field label="Описание">
        <TextArea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => onSave(normalizeMaterial(form))}>Сохранить</Button>
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
        <Button variant="danger" onClick={onDelete}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}
