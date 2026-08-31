"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTenant } from "@/lib/tenant/TenantContext";
import { subscribeUnread } from "@/lib/repository/notifications";

export function NotificationBell() {
  const { activeTenantId } = useTenant();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!activeTenantId) return;
    const unsub = subscribeUnread(activeTenantId, setCount);
    return () => unsub();
  }, [activeTenantId]);

  return (
    <Link
      href="/app/notifications"
      className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
      aria-label="Notificações"
      title="Notificações"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
