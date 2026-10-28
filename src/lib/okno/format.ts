export function money(value: number, currency = "TJS"): string {
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
  if (currency === "TJS") return `${formatted} сом.`;
  if (currency === "RUB") return `${formatted} ₽`;
  if (currency === "USD") return `${formatted} $`;
  if (currency === "EUR") return `${formatted} €`;
  return `${formatted} ${currency}`;
}

export function percent(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(ratio * 100)} %`;
}

export function num(value: number, digits = 2): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(date);
}
