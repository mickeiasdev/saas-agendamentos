"use client";

import { AuthProvider } from "@/lib/auth/AuthContext";
import { TenantProvider } from "@/lib/tenant/TenantContext";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TenantProvider>{children}</TenantProvider>
    </AuthProvider>
  );
}
