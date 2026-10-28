import { Link } from "@tanstack/react-router";
import { STATUS_LABEL } from "@/lib/okno/domain";
import { money } from "@/lib/okno/format";
import { customerName, useOkno } from "@/lib/okno/store";
import { Shell, useReady } from "@/components/okno/shell";
import { Card, PageTitle } from "@/components/okno/ui";

export function HomePage() {
  return (
    <Shell>
      <PageTitle
        title="Okno Master Pro"
        text="Расчёт пластиковых окон, дверей и монтажа. Данные хранятся в этом браузере; скачивайте резервную копию в настройках."
      />
      <HomeBody />
    </Shell>
  );
}

function HomeBody() {
  const ready = useReady();
  const customers = useOkno((state) => state.customers);
  const orders = useOkno((state) => state.orders);
  const currency = useOkno((state) => state.settings.currency);
  if (!ready) return <p className="text-sm text-muted">Загрузка данных…</p>;

  const active = orders.filter((order) => order.status !== "cancelled");
  const revenue = active.reduce((sum, order) => sum + order.totals.sale, 0);
  const profit = active.reduce((sum, order) => sum + order.totals.profit, 0);
  const recent = [...orders].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Клиенты" value={String(customers.length)} />
        <Stat label="Заказы" value={String(orders.length)} />
        <Stat label="Сумма без отмен" value={money(revenue, currency)} />
        <Stat label="Прибыль без отмен" value={money(profit, currency)} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Link to="/orders/$id" params={{ id: "new" }} className="inline-flex h-11 items-center rounded-md bg-navy px-4 text-sm font-semibold text-on-navy">
          Новый расчёт
        </Link>
        <Link to="/customers/$id" params={{ id: "new" }} className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold">
          Новый клиент
        </Link>
        <Link to="/materials" className="inline-flex h-11 items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold">
          Прайс
        </Link>
      </div>
      <Card>
        <h2 className="mb-3 text-base font-semibold">Последние заказы</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">Заказов пока нет. Создайте расчёт — цены возьмутся из стартового прайса, его можно сразу поменять.</p>
        ) : (
          <ul className="grid gap-2">
            {recent.map((order) => (
              <li key={order.id}>
                <Link to="/orders/$id" params={{ id: order.id }} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-bg">
                  <span>
                    <span className="font-medium">{order.number}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {customerName(customers, order.customerId)} · {STATUS_LABEL[order.status]}
                    </span>
                  </span>
                  <span className="tabular text-sm">{money(order.totals.sale, currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular tracking-tight">{value}</p>
    </Card>
  );
}
