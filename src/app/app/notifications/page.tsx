"use client";

import { useCallback, useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/repository/notifications";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime } from "@/lib/utils/format";
import type { Notification } from "@/types";

const TYPE_LABEL: Record<string, string> = {
  appointment: "Agendamento",
  confirmation: "Confirmação",
  cancellation: "Cancelamento",
  payment: "Pagamento",
  reminder: "Lembrete",
  system: "Sistema",
};

export default function NotificationsPage() {
  const { activeTenantId } = useTenant();
  const [items, setItems] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeTenantId) return;
    const list = await listNotifications(activeTenantId, {
      unreadOnly: filter === "unread",
      max: 50,
    });
    setItems(list);
    setLoading(false);
  }, [activeTenantId, filter]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (!activeTenantId) return null;

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notificações</h1>
          <p className="text-sm text-slate-500">
            Avisos internos sobre agendamentos, confirmações e pagamentos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="input w-40 py-1.5"
            value={filter}
            onChange={(e) => setFilter(e.target.value as "all" | "unread")}
          >
            <option value="all">Todas</option>
            <option value="unread">Não lidas ({unreadCount})</option>
          </select>
          {unreadCount > 0 && (
            <button
              className="btn-secondary py-1.5"
              onClick={async () => {
                await markAllNotificationsRead(activeTenantId);
                await load();
              }}
            >
              Marcar todas como lidas
            </button>
          )}
        </div>
      </div>

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Nenhuma notificação"
          description="Avisos sobre agendamentos e eventos aparecerão aqui."
        />
      ) : (
        <div className="card divide-y divide-slate-100 p-0">
          {items.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 px-4 py-3 ${n.read ? "opacity-70" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="badge bg-slate-100 text-slate-600">
                    {TYPE_LABEL[n.type] ?? n.type}
                  </span>
                  <span className="text-xs text-slate-400">{formatDateTime(n.createdAt)}</span>
                </div>
                <div className="mt-1 font-medium text-slate-900">{n.title}</div>
                <div className="text-sm text-slate-600">{n.body}</div>
              </div>
              {!n.read && (
                <button
                  className="text-xs text-brand-600 hover:underline"
                  onClick={async () => {
                    await markNotificationRead(activeTenantId, n.id);
                    await load();
                  }}
                >
                  Marcar como lida
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
