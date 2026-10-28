import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { computeTotals, validateQty, validateSize } from "@/lib/okno/calc";
import {
  blankDraft,
  customerFieldError,
  lineEquipment,
  lineTitle,
  nowIso,
  objectFieldError,
  overlayQuantities,
  priceLine,
  resolveRates,
  sameKit,
  STATUS_LABEL,
  STATUS_ORDER,
  todayIso,
  uid,
} from "@/lib/okno/domain";
import { formatDate, money, percent } from "@/lib/okno/format";
import { buildOfferPdf, printPdf, shareOrDownloadPdf } from "@/lib/okno/pdf";
import { customerName, objectName, useHydrated, useOkno } from "@/lib/okno/store";
import type {
  ConstructionDraft,
  Customer,
  DiscountMode,
  FrozenRates,
  Order,
  OrderLine,
  OrderStatus,
  SiteObject,
} from "@/lib/okno/types";
import { Constructor } from "@/components/okno/constructor";
import { Shell, useReady } from "@/components/okno/shell";
import {
  Button,
  Card,
  Empty,
  Field,
  Modal,
  NumberInput,
  PageTitle,
  Select,
  TextArea,
  TextInput,
} from "@/components/okno/ui";

export function OrdersPage() {
  return (
    <Shell>
      <OrdersBody />
    </Shell>
  );
}

function OrdersBody() {
  const ready = useReady();
  const orders = useOkno((state) => state.orders);
  const customers = useOkno((state) => state.customers);
  const currency = useOkno((state) => state.settings.currency);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...orders]
      .filter((order) => (status === "all" ? true : order.status === status))
      .filter((order) => {
        const blob = `${order.number} ${customerName(customers, order.customerId)}`.toLowerCase();
        return !q || blob.includes(q);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  }, [orders, customers, query, status]);

  return (
    <>
      <PageTitle
        title="Заказы"
        text="История расчётов. Откройте старый заказ — цены останутся теми, что были при сохранении."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Номер или клиент"
          aria-label="Поиск заказов"
          className="max-w-xs"
        />
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderStatus | "all")}
          className="max-w-56"
        >
          <option value="all">Все статусы</option>
          {STATUS_ORDER.map((item) => (
            <option key={item} value={item}>
              {STATUS_LABEL[item]}
            </option>
          ))}
        </Select>
        <Link
          to="/orders/$id"
          params={{ id: "new" }}
          className="inline-flex h-11 items-center rounded-md bg-navy px-4 text-sm font-semibold text-on-navy"
        >
          Новый заказ
        </Link>
      </div>
      {!ready ? <p className="text-sm text-muted">Загрузка данных…</p> : null}
      {ready && filtered.length === 0 ? (
        <Empty title="Заказов нет" text="Создайте расчёт и сохраните его как заказ." />
      ) : null}
      <ul className="grid gap-2">
        {ready
          ? filtered.map((order) => (
              <li key={order.id}>
                <Link to="/orders/$id" params={{ id: order.id }}>
                  <Card className="flex items-center justify-between gap-3">
                    <span>
                      <span className="font-semibold">{order.number}</span>
                      <span className="mt-1 block text-sm text-muted">
                        {formatDate(order.date)} · {customerName(customers, order.customerId)} ·{" "}
                        {STATUS_LABEL[order.status]}
                      </span>
                    </span>
                    <span className="tabular text-sm font-semibold">
                      {money(order.totals.sale, currency)}
                    </span>
                  </Card>
                </Link>
              </li>
            ))
          : null}
      </ul>
    </>
  );
}

interface DraftOrder {
  id: string;
  number: string;
  isNew: boolean;
  customerId: string;
  objectId: string;
  date: string;
  status: OrderStatus;
  comment: string;
  discountMode: DiscountMode;
  discountValue: number;
  extraSale: number;
  extraCost: number;
  lines: OrderLine[];
  createdAt: string;
}

export function OrderEditor({ orderId }: { orderId: string }) {
  const { ready } = useHydrated();
  const customers = useOkno((state) => state.customers);
  const objects = useOkno((state) => state.objects);
  const materials = useOkno((state) => state.materials);
  const settings = useOkno((state) => state.settings);
  const saveOrder = useOkno((state) => state.saveOrder);
  const deleteOrder = useOkno((state) => state.deleteOrder);
  const duplicateOrder = useOkno((state) => state.duplicateOrder);
  const saveCustomer = useOkno((state) => state.saveCustomer);
  const saveObject = useOkno((state) => state.saveObject);
  const setNotice = useOkno((state) => state.setNotice);
  const navigate = useNavigate();
  const [form, setForm] = useState<DraftOrder | null>(null);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<ConstructionDraft | null>(null);
  const [frozen, setFrozen] = useState<FrozenRates | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lineError, setLineError] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [objectError, setObjectError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState(false);
  const [quickObject, setQuickObject] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const state = useOkno.getState();
    if (orderId === "new") {
      const blank = blankDraft(state.settings, state.materials);
      setForm({
        id: uid(),
        number: "Новый",
        isNew: true,
        customerId: "",
        objectId: "",
        date: todayIso(),
        status: "draft",
        comment: "",
        discountMode: "percent",
        discountValue: 0,
        extraSale: 0,
        extraCost: 0,
        lines: [],
        createdAt: nowIso(),
      });
      setDraft(blank);
      setFrozen(null);
      setEditingId(null);
      setMissing(false);
      return;
    }
    const existing = state.orders.find((order) => order.id === orderId);
    if (!existing) {
      setForm(null);
      setMissing(true);
      return;
    }
    setForm(orderToDraft(existing));
    setDraft(null);
    setFrozen(null);
    setEditingId(null);
    setMissing(false);
  }, [ready, orderId]);

  if (!ready) {
    return (
      <Shell>
        <p className="text-sm text-muted">Загрузка данных…</p>
      </Shell>
    );
  }
  if (missing || !form) {
    return (
      <Shell>
        <Empty title="Заказ не найден" text="Проверьте список заказов." />
      </Shell>
    );
  }

  const totals = computeTotals(
    form.lines.map((line) => ({ sale: line.calc.sale, cost: line.calc.cost })),
    form.discountMode,
    form.discountValue,
    form.extraSale,
    form.extraCost,
    settings.rounding,
  );
  const siteOptions = objects.filter((object) => object.customerId === form.customerId);

  const commitLine = (nextDraft: ConstructionDraft, nextFrozen: FrozenRates | null) => {
    const sizeError = validateSize(nextDraft.widthMm, nextDraft.heightMm, settings);
    const qtyError = validateQty(nextDraft.qty);
    if (!nextDraft.profileId) return "Выберите профиль.";
    if (sizeError || qtyError) return sizeError || qtyError;
    const rates = nextFrozen ?? resolveRates(nextDraft, materials, settings);
    const priced = priceLine({ ...nextDraft, id: editingId ?? nextDraft.id }, rates);
    if ("error" in priced) return priced.error;
    const line = editingId ? { ...priced, id: editingId } : priced;
    setForm({
      ...form,
      lines: editingId
        ? form.lines.map((item) => (item.id === editingId ? line : item))
        : [...form.lines, line],
    });
    setDraft(null);
    setFrozen(null);
    setEditingId(null);
    setLineError(null);
    setOrderError(null);
    return null;
  };

  return (
    <Shell>
      <PageTitle
        title={form.isNew ? "Новый заказ" : form.number}
        text="Схема и сумма пересчитываются сразу. В сохранённом заказе остаётся снимок цен."
      />
      <Card className="mb-4 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Клиент" error={customerError}>
            <Select
              value={form.customerId}
              onChange={(event) => {
                setForm({ ...form, customerId: event.target.value, objectId: "" });
                setCustomerError(null);
                setObjectError(null);
              }}
            >
              <option value="">Не выбран</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Объект" error={objectError}>
            <Select
              value={form.objectId}
              onChange={(event) => {
                setForm({ ...form, objectId: event.target.value });
                setObjectError(null);
              }}
            >
              <option value="">Не выбран</option>
              {siteOptions.map((object) => (
                <option key={object.id} value={object.id}>
                  {object.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Дата">
            <TextInput
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </Field>
          <Field label="Статус">
            <Select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as OrderStatus })}
            >
              {STATUS_ORDER.map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={() => setQuickCustomer(true)}>
            Новый клиент
          </Button>
          <Button variant="ghost" onClick={() => setQuickObject(true)} disabled={!form.customerId}>
            Новый объект
          </Button>
          {!form.customerId ? (
            <p className="self-center text-sm text-muted">Сначала выберите или создайте клиента.</p>
          ) : null}
          {form.customerId && siteOptions.length === 0 ? (
            <p className="self-center text-sm text-muted">
              Создайте объект, чтобы привязать к нему заказ.
            </p>
          ) : null}
        </div>
      </Card>

      <div className="mb-4 grid gap-2">
        {form.lines.map((line, index) => (
          <Card key={line.id} className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {index + 1}. {lineTitle(line)} × {line.draft.qty}
              </p>
              <p className="mt-1 max-w-xl text-sm text-muted">{lineEquipment(line)}</p>
            </div>
            <div className="text-right">
              <p className="tabular font-semibold">{money(line.calc.sale, settings.currency)}</p>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditingId(line.id);
                    setDraft(structuredClone(line.draft));
                    setFrozen(structuredClone(line.rates));
                    setLineError(null);
                  }}
                >
                  Изменить
                </Button>
                <Button
                  variant="danger"
                  onClick={() =>
                    setForm({ ...form, lines: form.lines.filter((item) => item.id !== line.id) })
                  }
                >
                  Убрать
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {draft ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-base font-semibold">
            {editingId ? "Изменение конструкции" : "Новая конструкция"}
          </h2>
          {lineError ? <p className="mb-3 text-sm text-danger">{lineError}</p> : null}
          <Constructor
            draft={draft}
            frozen={frozen ? overlayQuantities(draft, frozen) : null}
            currency={settings.currency}
            onChange={(next) => {
              const original = editingId
                ? form.lines.find((line) => line.id === editingId)?.draft
                : null;
              if (frozen && original && !sameKit(original, next)) {
                setFrozen(null);
                setNotice("Комплектация изменилась — цены взяты из текущего прайса.");
              }
              setDraft(next);
            }}
            onUseCurrentPrices={() => setFrozen(null)}
            applyLabel={editingId ? "Обновить позицию" : "Добавить в заказ"}
            onCancel={() => {
              setDraft(null);
              setFrozen(null);
              setEditingId(null);
              setLineError(null);
            }}
            onApply={(error) => {
              if (error) {
                setLineError(error);
                return;
              }
              const message = commitLine(draft, frozen);
              if (message) setLineError(message);
            }}
          />
        </Card>
      ) : (
        <Button className="mb-4" onClick={() => setDraft(blankDraft(settings, materials))}>
          Добавить конструкцию
        </Button>
      )}

      <Card className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Скидка">
            <Select
              value={form.discountMode}
              onChange={(event) =>
                setForm({ ...form, discountMode: event.target.value as DiscountMode })
              }
            >
              <option value="percent">Процент</option>
              <option value="amount">Сумма</option>
            </Select>
          </Field>
          <Field label={form.discountMode === "percent" ? "Процент скидки" : "Сумма скидки"}>
            <NumberInput
              value={form.discountValue}
              onChange={(discountValue) => setForm({ ...form, discountValue })}
            />
          </Field>
          <Field label="Доставка и другие услуги, продажа" hint="Прибавляется к итогу.">
            <NumberInput
              value={form.extraSale}
              onChange={(extraSale) => setForm({ ...form, extraSale })}
            />
          </Field>
          <Field label="Себестоимость этих услуг">
            <NumberInput
              value={form.extraCost}
              onChange={(extraCost) => setForm({ ...form, extraCost })}
            />
          </Field>
        </div>
        <Field label="Комментарий">
          <TextArea
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.target.value })}
          />
        </Field>
        <dl className="grid gap-1 text-sm">
          <Money label="Сумма позиций" value={money(totals.subtotalSale, settings.currency)} />
          <Money label="Себестоимость" value={money(totals.cost, settings.currency)} />
          <Money label="Скидка" value={money(totals.discount, settings.currency)} />
          <Money label="Наценка" value={percent(totals.markup)} />
          <Money label="Маржа" value={percent(totals.margin)} />
          <Money label="Прибыль" value={money(totals.profit, settings.currency)} />
          <div className="flex justify-between pt-1 text-base font-semibold">
            <dt>Итого</dt>
            <dd className="tabular">{money(totals.sale, settings.currency)}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const nextCustomerError = form.customerId ? null : "Создайте или выберите клиента.";
              const nextObjectError =
                form.customerId && !form.objectId
                  ? "Создайте или выберите объект для этого клиента."
                  : null;
              setCustomerError(nextCustomerError);
              setObjectError(nextObjectError);
              const nextOrderError = form.lines.length
                ? null
                : "Добавьте хотя бы одну конструкцию перед сохранением.";
              setOrderError(nextOrderError);
              if (nextCustomerError || nextObjectError || nextOrderError) {
                return;
              }
              const saved = saveOrder(draftToOrder(form, totals), { allocateNumber: form.isNew });
              setForm(orderToDraft(saved));
              setCustomerError(null);
              setObjectError(null);
              setOrderError(null);
              setNotice("Заказ сохранён.");
              if (form.isNew) void navigate({ to: "/orders/$id", params: { id: saved.id } });
            }}
          >
            Сохранить заказ
          </Button>
          {!form.isNew ? (
            <>
              <Button variant="ghost" disabled={busy} onClick={() => void runPdf(form, "download")}>
                PDF
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void runPdf(form, "print")}>
                Печать
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void runPdf(form, "share")}>
                Отправить
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const id = duplicateOrder(form.id);
                  if (id) void navigate({ to: "/orders/$id", params: { id } });
                }}
              >
                Копировать
              </Button>
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                Удалить
              </Button>
            </>
          ) : null}
        </div>
        {orderError ? (
          <p className="text-sm text-danger" role="alert">
            {orderError}
          </p>
        ) : null}
      </Card>
      <QuickCustomer
        open={quickCustomer}
        onClose={() => setQuickCustomer(false)}
        onCreate={(customer) => {
          const fieldError = customerFieldError(customer);
          if (fieldError) return fieldError;
          saveCustomer(customer);
          setForm({ ...form, customerId: customer.id, objectId: "" });
          setCustomerError(null);
          setObjectError(null);
          setQuickCustomer(false);
          return null;
        }}
      />
      <QuickObject
        open={quickObject}
        customerId={form.customerId}
        onClose={() => setQuickObject(false)}
        onCreate={(object) => {
          const fieldError = objectFieldError(object);
          if (fieldError) return fieldError;
          saveObject(object);
          setForm({ ...form, objectId: object.id });
          setObjectError(null);
          setQuickObject(false);
          return null;
        }}
      />
      <Modal open={confirmDelete} title="Удалить заказ?" onClose={() => setConfirmDelete(false)}>
        <p className="mb-4 text-sm text-muted">
          Заказ будет удалён из данных этого браузера. Копию можно сделать заранее.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              deleteOrder(form.id);
              void navigate({ to: "/orders" });
            }}
          >
            Удалить
          </Button>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </Shell>
  );

  async function runPdf(current: DraftOrder, mode: "download" | "print" | "share") {
    setBusy(true);
    try {
      const order = draftToOrder(current, totals);
      const bytes = await buildOfferPdf(
        order,
        customers.find((customer) => customer.id === current.customerId),
        objects.find((object) => object.id === current.objectId),
        settings,
      );
      const filename = `${order.number}.pdf`;
      if (mode === "print") printPdf(bytes);
      else if (mode === "share") await shareOrDownloadPdf(bytes, filename, order.number);
      else {
        const { downloadBytes } = await import("@/lib/okno/pdf");
        downloadBytes(bytes, filename, "application/pdf");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Не удалось создать PDF.");
    } finally {
      setBusy(false);
    }
  }
}

function Money({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function orderToDraft(order: Order): DraftOrder {
  return {
    id: order.id,
    number: order.number,
    isNew: false,
    customerId: order.customerId,
    objectId: order.objectId,
    date: order.date,
    status: order.status,
    comment: order.comment,
    discountMode: order.discountMode,
    discountValue: order.discountValue,
    extraSale: order.extraSale,
    extraCost: order.extraCost,
    lines: order.lines,
    createdAt: order.createdAt,
  };
}

function draftToOrder(form: DraftOrder, totals: Order["totals"]): Order {
  return {
    id: form.id,
    number: form.number,
    customerId: form.customerId,
    objectId: form.objectId,
    date: form.date,
    lines: form.lines,
    discountMode: form.discountMode,
    discountValue: form.discountValue,
    extraSale: form.extraSale,
    extraCost: form.extraCost,
    comment: form.comment,
    status: form.status,
    createdAt: form.createdAt,
    updatedAt: nowIso(),
    totals,
  };
}

function QuickCustomer({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (customer: Customer) => string | null;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={open}
      title="Новый клиент"
      onClose={() => {
        setName("");
        setPhone("");
        setError(null);
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Имя" error={error}>
          <TextInput
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </Field>
        <Field label="Телефон">
          <TextInput value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Button
          onClick={() => {
            const result = onCreate({
              id: uid(),
              name,
              phone,
              email: "",
              address: "",
              comment: "",
              createdAt: nowIso(),
            });
            setError(result);
            if (!result) {
              setName("");
              setPhone("");
            }
          }}
        >
          Создать
        </Button>
      </div>
    </Modal>
  );
}

function QuickObject({
  open,
  customerId,
  onClose,
  onCreate,
}: {
  open: boolean;
  customerId: string;
  onClose: () => void;
  onCreate: (object: SiteObject) => string | null;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={open}
      title="Новый объект"
      onClose={() => {
        setName("");
        setAddress("");
        setError(null);
        onClose();
      }}
    >
      <div className="grid gap-3">
        <Field label="Название" error={error}>
          <TextInput
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </Field>
        <Field label="Адрес">
          <TextInput value={address} onChange={(event) => setAddress(event.target.value)} />
        </Field>
        <Button
          onClick={() => {
            const result = onCreate({
              id: uid(),
              customerId,
              name,
              address,
              measureDate: todayIso(),
              comment: "",
              createdAt: nowIso(),
            });
            setError(result);
            if (!result) {
              setName("");
              setAddress("");
            }
          }}
        >
          Создать
        </Button>
      </div>
    </Modal>
  );
}
