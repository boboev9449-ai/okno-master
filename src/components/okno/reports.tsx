import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KIND_LABEL } from "@/lib/okno/domain";
import { money } from "@/lib/okno/format";
import { useOkno } from "@/lib/okno/store";
import { Shell, useReady } from "@/components/okno/shell";
import { Card, PageTitle, TextInput } from "@/components/okno/ui";

export function ReportsPage() {
  return (
    <Shell>
      <ReportsBody />
    </Shell>
  );
}

function ReportsBody() {
  const ready = useReady();
  const orders = useOkno((state) => state.orders);
  const currency = useOkno((state) => state.settings.currency);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const report = useMemo(() => {
    const period = orders.filter((order) => order.date >= from && order.date <= to);
    const cancelled = period.filter((order) => order.status === "cancelled");
    const active = period.filter((order) => order.status !== "cancelled");
    const revenue = active.reduce((sum, order) => sum + order.totals.sale, 0);
    const cost = active.reduce((sum, order) => sum + order.totals.cost, 0);
    const profit = active.reduce((sum, order) => sum + order.totals.profit, 0);
    const counts = new Map<string, number>();
    for (const order of active) {
      for (const line of order.lines) {
        const label = KIND_LABEL[line.draft.kind];
        counts.set(label, (counts.get(label) ?? 0) + line.draft.qty);
      }
    }
    const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const months = new Map<string, number>();
    for (const order of active) {
      const key = order.date.slice(0, 7);
      months.set(key, (months.get(key) ?? 0) + order.totals.sale);
    }
    const series = [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, sum]) => ({ month, sum: Math.round(sum) }));
    return {
      count: active.length,
      revenue,
      cost,
      profit,
      average: active.length ? revenue / active.length : 0,
      cancelled: cancelled.length,
      cancelledSum: cancelled.reduce((sum, order) => sum + order.totals.sale, 0),
      popular,
      series,
    };
  }, [orders, from, to]);

  return (
    <>
      <PageTitle title="Отчёты" text="Продажи за выбранные даты. Отменённые заказы не входят в выручку и прибыль." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-muted">С</span>
          <TextInput type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-muted">По</span>
          <TextInput type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      {!ready ? <p className="text-sm text-muted">Загрузка данных…</p> : null}
      {ready ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Заказы" value={String(report.count)} />
          <Stat label="Выручка" value={money(report.revenue, currency)} />
          <Stat label="Себестоимость" value={money(report.cost, currency)} />
          <Stat label="Прибыль" value={money(report.profit, currency)} />
          <Stat label="Средний чек" value={money(report.average, currency)} />
          <Stat label="Отменённые" value={`${report.cancelled} · ${money(report.cancelledSum, currency)}`} />
        </div>
      ) : null}
      {ready ? (
        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold">Выручка по месяцам</h2>
          {report.series.length === 0 ? (
            <p className="text-sm text-muted">За период нет заказов, кроме возможной отмены.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.series}>
                  <XAxis dataKey="month" tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--color-muted)", fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
                  <Tooltip
                    cursor={{ fill: "var(--color-line)" }}
                    contentStyle={{ background: "var(--color-surface)", border: "1px solid var(--color-line)", borderRadius: 12, color: "var(--color-ink)" }}
                  />
                  <Bar dataKey="sum" fill="var(--color-navy)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      ) : null}
      {ready ? (
        <Card className="mt-4">
          <h2 className="mb-3 text-base font-semibold">Популярные конструкции</h2>
          {report.popular.length === 0 ? <p className="text-sm text-muted">Пока нечего сравнивать.</p> : null}
          <ul className="grid gap-2">
            {report.popular.map(([label, count]) => (
              <li key={label} className="flex items-center justify-between text-sm">
                <span>{label}</span>
                <span className="tabular text-muted">{count} шт.</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-2 text-lg font-semibold tabular">{value}</p>
    </Card>
  );
}
