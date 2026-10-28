import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { customerFieldError, nowIso, uid } from "@/lib/okno/domain";
import type { Customer } from "@/lib/okno/types";
import { useOkno, useHydrated } from "@/lib/okno/store";
import { Shell, useReady } from "@/components/okno/shell";
import { Button, Card, Empty, Field, Modal, PageTitle, TextArea, TextInput } from "@/components/okno/ui";

export function CustomersPage() {
  return (
    <Shell>
      <CustomersBody />
    </Shell>
  );
}

function CustomersBody() {
  const ready = useReady();
  const customers = useOkno((state) => state.customers);
  const objects = useOkno((state) => state.objects);
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers
      .filter((customer) =>
        !q
          ? true
          : [customer.name, customer.phone, customer.email, customer.address].join(" ").toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [customers, query]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Клиенты" text="Имя, телефон, почта, адрес и комментарий. У клиента может быть несколько объектов." />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Поиск"
          className="max-w-sm"
          aria-label="Поиск клиентов"
        />
        <Link to="/customers/$id" params={{ id: "new" }} className="inline-flex h-11 items-center rounded-md bg-navy px-4 text-sm font-semibold text-on-navy">
          Новый клиент
        </Link>
      </div>
      {!ready ? <p className="text-sm text-muted">Загрузка данных…</p> : null}
      {ready && filtered.length === 0 ? (
        <Empty title="Клиентов нет" text="Добавьте первого клиента, чтобы привязать объект и заказ." />
      ) : null}
      <ul className="grid gap-2">
        {ready
          ? filtered.map((customer) => (
              <li key={customer.id}>
                <Link to="/customers/$id" params={{ id: customer.id }}>
                  <Card className="hover:border-navy">
                    <p className="font-semibold">{customer.name}</p>
                    <p className="mt-1 text-sm text-muted">
                      {[customer.phone, customer.address].filter(Boolean).join(" · ") || "Контакты не указаны"}
                    </p>
                    <p className="mt-1 text-xs text-faint">
                      Объектов: {objects.filter((object) => object.customerId === customer.id).length}
                    </p>
                  </Card>
                </Link>
              </li>
            ))
          : null}
      </ul>
    </>
  );
}

export function CustomerEditor({ customerId }: { customerId: string }) {
  const { ready } = useHydrated();
  const objects = useOkno((state) => state.objects);
  const orders = useOkno((state) => state.orders);
  const saveCustomer = useOkno((state) => state.saveCustomer);
  const deleteCustomer = useOkno((state) => state.deleteCustomer);
  const setNotice = useOkno((state) => state.setNotice);
  const navigate = useNavigate();
  const [form, setForm] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (customerId === "new") {
      setForm({ id: uid(), name: "", phone: "", email: "", address: "", comment: "", createdAt: nowIso() });
      return;
    }
    setForm(useOkno.getState().customers.find((customer) => customer.id === customerId) ?? null);
  }, [ready, customerId]);

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
        <Empty title="Клиент не найден" text="Возможно, запись удалена из данных этого браузера." />
      </Shell>
    );
  }

  const relatedObjects = objects.filter((object) => object.customerId === form.id);
  const isNew = customerId === "new";

  return (
    <Shell>
      <PageTitle title={isNew ? "Новый клиент" : form.name || "Клиент"} />
      <Card className="grid gap-3">
        <Field label="ФИО или организация" error={error}>
          <TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Телефон">
            <TextInput value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} inputMode="tel" />
          </Field>
          <Field label="Электронная почта">
            <TextInput value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} inputMode="email" />
          </Field>
        </div>
        <Field label="Адрес">
          <TextInput value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </Field>
        <Field label="Комментарий">
          <TextArea value={form.comment} onChange={(event) => setForm({ ...form, comment: event.target.value })} />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              const fieldError = customerFieldError(form);
              if (fieldError) {
                setError(fieldError);
                return;
              }
              saveCustomer({ ...form, name: form.name.trim(), email: form.email.trim() });
              setNotice("Клиент сохранён.");
              void navigate({ to: "/customers/$id", params: { id: form.id } });
            }}
          >
            Сохранить
          </Button>
          {!isNew ? (
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Удалить
            </Button>
          ) : null}
          <Link to="/customers" className="inline-flex h-11 items-center px-2 text-sm text-muted">
            К списку
          </Link>
        </div>
      </Card>
      {!isNew ? (
        <div className="mt-4 grid gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Объекты</h2>
            <Link
              to="/objects/$id"
              params={{ id: "new" }}
              search={{ customerId: form.id }}
              className="text-sm font-semibold text-navy"
            >
              Добавить объект
            </Link>
          </div>
          {relatedObjects.length === 0 ? <Empty title="Объектов нет" text="Адрес замера хранится отдельно от карточки клиента." /> : null}
          <ul className="grid gap-2">
            {relatedObjects.map((object) => (
              <li key={object.id}>
                <Link to="/objects/$id" params={{ id: object.id }} search={{ customerId: undefined }} className="block rounded-xl border border-line bg-surface px-4 py-3">
                  <span className="font-medium">{object.name}</span>
                  <span className="mt-1 block text-sm text-muted">{object.address || "Адрес не указан"}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-faint">Заказов: {orders.filter((order) => order.customerId === form.id).length}</p>
        </div>
      ) : null}
      <Modal open={confirm} title="Удалить клиента?" onClose={() => setConfirm(false)}>
        <p className="mb-4 text-sm text-muted">Удаление необратимо. Если есть объекты или заказы, клиент не будет удалён.</p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={() => {
              const message = deleteCustomer(form.id);
              if (message) {
                setNotice(message);
                setConfirm(false);
                return;
              }
              void navigate({ to: "/customers" });
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
