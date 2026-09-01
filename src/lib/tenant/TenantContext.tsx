import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { getPlanLimits, PLAN_ID } from "@/lib/plans";
import { slugify } from "@/lib/tenant/slug";
import type { Tenant, TenantUser } from "@/types";

export interface TenantState {
  memberships: TenantUser[];
  activeTenantId: string | null;
  activeTenant: Tenant | null;
  loading: boolean;
  switchTenant: (tenantId: string) => void;
  createTenant: (input: CreateTenantInput) => Promise<string>;
  refreshActiveTenant: () => Promise<void>;
}

export interface CreateTenantInput {
  name: string;
  tradeName?: string;
  cnpjCpf?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  description?: string;
  logoUrl?: string;
  segmentId?: string;
  slug: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
}

const TenantContext = createContext<TenantState | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [memberships, setMemberships] = useState<TenantUser[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setMemberships([]);
      setActiveTenantId(null);
      setActiveTenant(null);
      return;
    }
    setLoading(true);
    const db = getFirebaseFirestore();
    const q = query(collection(db, "tenant_users"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const list = snap.docs.map((d) => d.data() as TenantUser);
      setMemberships(list);
      const saved = profile?.activeTenantId;
      const initial = saved && list.some((m) => m.tenantId === saved) ? saved : list[0]?.tenantId ?? null;
      setActiveTenantId(initial);
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile?.activeTenantId]);

  const refreshActiveTenant = useCallback(async () => {
    if (!activeTenantId) return;
    const db = getFirebaseFirestore();
    const snap = await getDoc(doc(db, "tenants", activeTenantId));
    if (snap.exists()) setActiveTenant(snap.data() as Tenant);
  }, [activeTenantId]);

  useEffect(() => {
    if (!activeTenantId) {
      setActiveTenant(null);
      return;
    }
    const db = getFirebaseFirestore();
    const unsub = onSnapshot(doc(db, "tenants", activeTenantId), (snap) => {
      if (snap.exists()) setActiveTenant(snap.data() as Tenant);
    });
    return () => unsub();
  }, [activeTenantId]);

  const switchTenant = useCallback(
    (tenantId: string) => {
      setActiveTenantId(tenantId);
      if (user) {
        const db = getFirebaseFirestore();
        void setDoc(
          doc(db, "users", user.uid),
          { activeTenantId: tenantId },
          { merge: true }
        );
      }
    },
    [user]
  );

  const createTenant = useCallback(
    async (input: CreateTenantInput): Promise<string> => {
      if (!user) throw new Error("Usuário não autenticado");
      const db = getFirebaseFirestore();
      const tenantRef = doc(collection(db, "tenants"));
      const tenantId = tenantRef.id;
      const now = serverTimestamp();

      const tenant: Tenant = {
        id: tenantId,
        slug: slugify(input.slug || input.name),
        name: input.name,
        tradeName: input.tradeName,
        cnpjCpf: input.cnpjCpf,
        phone: input.phone,
        whatsapp: input.whatsapp,
        email: input.email,
        instagram: input.instagram,
        description: input.description,
        logoUrl: input.logoUrl,
        address: input.address,
        segmentId: input.segmentId as never,
        planId: "ALL",
        status: "active",
        subscriptionStatus: "TRIAL",
        ownerUserId: user.uid,
        createdAt: now as never,
        updatedAt: now as never,
        settings: {
          timezone: "America/Sao_Paulo",
          currency: "BRL",
          slotIntervalMinutes: 30,
          bookingLeadTimeMinutes: 60,
          bookingCancelWindowMinutes: 120,
          confirmationRequired: false,
          allowOnlinePayments: false,
        },
        branding: {
          primaryColor: "#4f46e5",
          secondaryColor: "#0f172a",
          theme: "light",
          galleryUrls: [],
          testimonials: [],
          faq: [],
          socialLinks: {},
          showContact: true,
          showLocation: true,
          sectionOrder: ["services", "professionals", "about", "contact"],
        },
        featureFlags: {
          payments: true,
          whatsapp: true,
          customDomain: true,
          reports: true,
          loyalty: true,
          inventory: true,
          multiBranch: true,
          api: true,
        },
        limits: getPlanLimits(PLAN_ID),
      };

      const member: TenantUser = {
        userId: user.uid,
        tenantId,
        role: "TENANT_OWNER",
        status: "active",
        displayName: user.displayName ?? user.email ?? "",
        createdAt: now as never,
      };

      const batch = writeBatch(db);
      batch.set(tenantRef, tenant);
      batch.set(doc(db, "tenant_users", `${user.uid}_${tenantId}`), member);
      batch.set(
        doc(db, "users", user.uid),
        { activeTenantId: tenantId },
        { merge: true }
      );
      await batch.commit();
      setActiveTenantId(tenantId);
      return tenantId;
    },
    [user]
  );

  const value = useMemo(
    () => ({
      memberships,
      activeTenantId,
      activeTenant,
      loading,
      switchTenant,
      createTenant,
      refreshActiveTenant,
    }),
    [memberships, activeTenantId, activeTenant, loading, switchTenant, createTenant, refreshActiveTenant]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de <TenantProvider>");
  return ctx;
}
