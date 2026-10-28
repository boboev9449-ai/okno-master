import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { formatDate } from "@/lib/okno/format";
import { nowIso, objectFieldError, uid } from "@/lib/okno/domain";
import type { SiteObject } from "@/lib/okno/types";
import { customerName, useHydrated, useOkno } from "@/lib/okno/store";
import { Shell, useReady } from "@/components/okno/shell";
import {
  Button,
  Card,
  Empty,
  Field,
  Modal,
  PageTitle,
  Select,
  TextArea,
  TextInput,
} from "@/components/okno/ui";

export function ObjectsPage() {
  return (
    <Shell>
      <ObjectsBody />
    </Shell>
  );
}

function ObjectsBody() {
  const ready = useReady();
  const objects = useOkno((state) => state.objects);
  const customers = useOkno((state) => state.customers);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return objects
      .filter((object) => {
        const name = customerName(customers, object.customerId);
        return !q || [object.name, object.address, name].join(" ").toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [objects, customers, query]);

  return (
    <>
      <PageTitle
        title="Объекты"
        text="Адрес замера и комментарий. У объекта может быть несколько заказов."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск"
          aria-label="Поиск объектов"
          className="max-w-sm"
        />
        <Link
          to="/objects/$id"
          params={{ id: "new" }}
          search={{ customerId: undefined }}
          className="inline-flex h-11 items-center rounded-md bg-navy px-4 text-sm font-semibold text-on-navy"
        >
          Новый объект
        </Link>
      </div>
      {!ready ? <p className="text-sm text-muted">Загрузка данных…</p> : null}
      {ready && filtered.length === 0 ? (
        <Empty title="Объектов нет" text="Создайте объект и привяжите его к клиенту." />
      ) : null}
      <ul className="grid gap-2">
        {ready
          ? filtered.map((object) => (
              <li key={object.id}>
                <Link
                  to="/objects/$id"
                  params={{ id: object.id }}
                  search={{ customerId: undefined }}
                >
                  <Card>
                    <p className="font-semibold">{object.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {customerName(customers, object.customerId)}
                    </p>
                    <p className="text-sm text-muted">{object.address || "Адрес не указан"}</p>
                  </Card>
                </Link>
              </li>
            ))
          : null}
      </ul>
    </>
  );
}

export function ObjectEditor({ objectId, customerId }: { objectId: string; customerId?: string }) {
  const { ready } = useHydrated();
  const customers = useOkno((state) => state.customers);
  const orders = useOkno((state) => state.orders);
  const saveObject = useOkno((state) => state.saveObject);
  const deleteObject = useOkno((state) => state.deleteObject);
  const setNotice = useOkno((state) => state.setNotice);
  const navigate = useNavigate();
  const [form, setForm] = useState<SiteObject | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!ready) return;
    setCustomerError(null);
    setNameError(null);
    if (objectId === "new") {
      setForm({
        id: uid(),
        customerId: customerId || useOkno.getState().customers[0]?.id || "",
        name: "",
        address: "",
        measureDate: "",
        comment: "",
        createdAt: nowIso(),
      });
      return;
    }
    setForm(useOkno.getState().objects.find((object) => object.id === objectId) ?? null);
  }, [ready, objectId, customerId]);

  if (!ready) {
    return (
      <Shell>
        <p className="text-sm text-muted">Загрузка данных…</p>
      </Shell>
    );
  }
  if (!form) {
    return (
      <Shell>
        <Empty title="Объект не найден" text="Запись отсутствует в данных этого браузера." />
      </Shell>
    );
  }
  const isNew = objectId === "new";
  const related = orders.filter((order) => order.objectId === form.id);

  return (
    <Shell>
      <PageTitle title={isNew ? "Новый объект" : form.name || "Объект"} />
      <Card className="grid gap-3">
        <Field label="Клиент" error={customerError}>
          <Select
            value={form.customerId}
            onChange={(event) => {
              setForm({ ...form, customerId: event.target.value });
              setCustomerError(null);
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
        <Field label="Название" error={nameError}>
          <TextInput
            value={form.name}
            onChange={(event) => {
              setForm({ ...form, name: event.target.value });
              setNameError(null);
            }}
          />
        </Field>
        <Field label="Адрес">
          <TextInput
            value={form.address}
            onChange={(event) => setForm({ ...form, address: event.target.value })}
          />
        </Field>
        <Field label="Дата замера">
          <TextInput
            type="date"
            value={form.measureDate}
            onChange={(event) => setForm({ ...form, measureDate: event.target.value })}
          />
        </Field>
        <Field label="Комментарий">
          <TextArea
            value={form.comment}
            onChange={(event) => setForm({ ...form, comment: event.target.value })}
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const fieldError = objectFieldError(form);
              if (fieldError) {
                if (!form.customerId) setCustomerError(fieldError);
                else setNameError(fieldError);
                return;
              }
              setCustomerError(null);
              setNameError(null);
              saveObject({ ...form, name: form.name.trim() });
              setNotice("Объект сохранён.");
              void navigate({
                to: "/objects/$id",
                params: { id: form.id },
                search: { customerId: undefined },
              });
            }}
          >
            Сохранить
          </Button>
          {!isNew ? (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Удалить
            </Button>
          ) : null}
        </div>
      </Card>
      {!isNew && form.measureDate ? (
        <p className="mt-3 text-sm text-muted">Замер: {formatDate(form.measureDate)}</p>
      ) : null}
      {!isNew ? (
        <ul className="mt-4 grid gap-2">
          {related.length === 0 ? (
            <Empty
              title="Заказов по объекту нет"
              text="Новый расчёт можно создать из раздела заказов."
            />
          ) : null}
          {related.map((order) => (
            <li key={order.id}>
              <Link
                to="/orders/$id"
                params={{ id: order.id }}
                className="block rounded-xl border border-line bg-surface px-4 py-3 text-sm"
              >
                {order.number}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      <Modal open={confirm} title="Удалить объект?" onClose={() => setConfirm(false)}>
        <p className="mb-4 text-sm text-muted">
          Если по объекту есть заказы, удаление будет отклонено.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              const message = deleteObject(form.id);
              if (message) {
                setNotice(message);
                setConfirm(false);
                return;
              }
              void navigate({ to: "/objects" });
            }}
          >
            Удалить
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </Shell>
  );
}
