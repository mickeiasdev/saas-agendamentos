"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTenant } from "@/lib/tenant/TenantContext";
import { can, type Permission, ROLE_NAMES } from "@/lib/rbac/roles";
import FirebaseSetupGuide from "@/components/FirebaseSetupGuide";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils/format";

interface NavItem {
  href: string;
  label: string;
  permission?: Permission;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "Dashboard" },
  { href: "/app/agenda", label: "Agenda" },
  { href: "/app/appointments", label: "Agendamentos" },
  { href: "/app/customers", label: "Clientes", permission: "customer.view" },
  { href: "/app/services", label: "Serviços", permission: "service.manage" },
  { href: "/app/categories", label: "Categorias", permission: "category.manage" },
  { href: "/app/professionals", label: "Profissionais", permission: "professional.manage" },
  { href: "/app/availability", label: "Disponibilidade", permission: "availability.manage" },
  { href: "/app/holidays", label: "Feriados", permission: "availability.manage" },
  { href: "/app/coupons", label: "Cupons", permission: "coupon.manage" },
  { href: "/app/reviews", label: "Avaliações", permission: "review.manage" },
  { href: "/app/reports", label: "Relatórios", permission: "reports.view" },
  { href: "/app/settings", label: "Configurações", permission: "settings.manage" },
  { href: "/app/master", label: "Painel Master", permission: "master.view" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, configured, logout } = useAuth();
  const { memberships, activeTenant, activeTenantId, switchTenant, loading: tenantLoading } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!configured) return;
    if (!loading && !user) router.replace("/login");
  }, [configured, loading, user, router]);

  if (!configured) return <FirebaseSetupGuide />;
  if (loading || tenantLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }
  if (!user) return null;

  const isOnboarding = pathname === "/app/onboarding";
  if (!activeTenant && !isOnboarding) {
    router.replace("/app/onboarding");
    return null;
  }

  const membership = memberships.find((m) => m.tenantId === activeTenantId);
  const role = membership?.role;

  const visibleItems = NAV_ITEMS.filter((item) => !item.permission || can(role, item.permission));

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            A
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">
              {activeTenant?.tradeName ?? activeTenant?.name ?? "Agenda SaaS"}
            </div>
            <div className="truncate text-xs text-slate-500">
              {role ? ROLE_NAMES[role] : "Plataforma"}
            </div>
          </div>
        </div>
        {activeTenant && (
          <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
            <select
              className="input flex-1 py-1.5 text-sm"
              value={activeTenantId ?? ""}
              onChange={(e) => switchTenant(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.tenantId} value={m.tenantId}>
                  {m.displayName ?? m.tenantId}
                </option>
              ))}
            </select>
            <NotificationBell />
          </div>
        )}
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-2 truncate text-sm font-medium text-slate-700">
            {user.email}
          </div>
          <button
            onClick={async () => {
              await logout();
              router.replace("/");
            }}
            className="btn-secondary w-full"
          >
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Abrir menu"
            >
              Menu
            </button>
            <span className="font-bold text-slate-900">Agenda SaaS</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <button
              onClick={async () => {
                await logout();
                router.replace("/");
              }}
              className="text-sm text-slate-500"
            >
              Sair
            </button>
          </div>
        </header>

        {menuOpen && (
          <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            {activeTenant && (
              <select
                className="input mb-3 py-1.5 text-sm"
                value={activeTenantId ?? ""}
                onChange={(e) => switchTenant(e.target.value)}
              >
                {memberships.map((m) => (
                  <option key={m.tenantId} value={m.tenantId}>
                    {m.displayName ?? m.tenantId}
                  </option>
                ))}
              </select>
            )}
            <nav className="grid grid-cols-2 gap-2">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                    pathname === item.href
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
