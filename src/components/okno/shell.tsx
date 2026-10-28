import { createContext, useContext, useEffect, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import { useHydrated, useOkno } from "@/lib/okno/store";

const ReadyContext = createContext(false);
export function useReady() {
  return useContext(ReadyContext);
}

const links = [
  { to: "/", label: "Главная", icon: LayoutDashboard },
  { to: "/customers", label: "Клиенты", icon: Users },
  { to: "/objects", label: "Объекты", icon: Building2 },
  { to: "/orders", label: "Заказы", icon: ClipboardList },
  { to: "/materials", label: "Прайс", icon: Tags },
  { to: "/reports", label: "Отчёты", icon: BarChart3 },
  { to: "/settings", label: "Настройки", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const { ready, error, retry } = useHydrated();
  const theme = useOkno((state) => state.settings.theme);
  const notice = useOkno((state) => state.notice);
  const setNotice = useOkno((state) => state.setNotice);
  const path = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);

  return !ready ? (
    <main className="grid min-h-screen place-items-center bg-bg p-6 text-ink">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center">
        {error ? (
          <>
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 rounded-md bg-navy px-4 py-2 text-sm font-semibold text-on-navy"
            >
              Повторить загрузку
            </button>
          </>
        ) : (
          <p className="text-sm text-muted">Загружаем данные из браузера…</p>
        )}
      </div>
    </main>
  ) : (
    <ReadyContext.Provider value={ready}>
      <div className="min-h-dvh bg-bg text-ink lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
          <Brand />
          <nav className="mt-6 grid gap-1">
            {links.map((link) => (
              <NavLink key={link.to} {...link} active={isActive(path, link.to)} />
            ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur-sm lg:hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <Brand compact />
            </div>
            <nav className="flex gap-1 overflow-x-auto px-3 pb-3">
              {links.map((link) => (
                <NavLink key={link.to} {...link} active={isActive(path, link.to)} compact />
              ))}
            </nav>
          </header>
          {notice ? (
            <div
              className="border-b border-line bg-surface px-4 py-2 text-sm text-ink"
              role="status"
            >
              {notice}
            </div>
          ) : null}
          <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>
        </div>
      </div>
    </ReadyContext.Provider>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="grid gap-0.5 px-2">
      <span className={`font-semibold tracking-tight ${compact ? "text-base" : "text-lg"}`}>
        Okno Master Pro
      </span>
      {compact ? null : <span className="text-xs text-muted">Окна и двери</span>}
    </Link>
  );
}

function NavLink({
  to,
  label,
  icon: Icon,
  active,
  compact = false,
}: {
  to: (typeof links)[number]["to"];
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium ${
        active ? "bg-navy text-on-navy" : "text-muted hover:bg-bg hover:text-ink"
      } ${compact ? "whitespace-nowrap" : ""}`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function isActive(path: string, to: string) {
  if (to === "/") return path === "/";
  return path === to || path.startsWith(`${to}/`);
}
