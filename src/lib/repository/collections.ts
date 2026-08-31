import { collection, type Firestore } from "firebase/firestore";

/** Coleções globalmente escopadas pela tenancy. */
export const globalCollections = {
  users: (db: Firestore) => collection(db, "users"),
  tenants: (db: Firestore) => collection(db, "tenants"),
  tenantUsers: (db: Firestore) => collection(db, "tenant_users"),
  plans: (db: Firestore) => collection(db, "plans"),
} as const;

/** Coleções subordinadas ao documento do tenant. */
export function tenantCollections(db: Firestore, tenantId: string) {
  return {
    categories: () => collection(db, "tenants", tenantId, "categories"),
    services: () => collection(db, "tenants", tenantId, "services"),
    professionals: () => collection(db, "tenants", tenantId, "professionals"),
    availability: () => collection(db, "tenants", tenantId, "availability"),
    customers: () => collection(db, "tenants", tenantId, "customers"),
    appointments: () => collection(db, "tenants", tenantId, "appointments"),
    payments: () => collection(db, "tenants", tenantId, "payments"),
    coupons: () => collection(db, "tenants", tenantId, "coupons"),
    reviews: () => collection(db, "tenants", tenantId, "reviews"),
    notifications: () => collection(db, "tenants", tenantId, "notifications"),
    audit: () => collection(db, "tenants", tenantId, "audit"),
    holidays: () => collection(db, "tenants", tenantId, "holidays"),
    subscriptions: () => collection(db, "tenants", tenantId, "subscriptions"),
    webhookEvents: () => collection(db, "tenants", tenantId, "webhook_events"),
    loyaltyRewards: () => collection(db, "tenants", tenantId, "loyalty_rewards"),
    loyaltyAccounts: () => collection(db, "tenants", tenantId, "loyalty_accounts"),
    loyaltyTransactions: () => collection(db, "tenants", tenantId, "loyalty_transactions"),
    financial: () => collection(db, "tenants", tenantId, "financial"),
    promotions: () => collection(db, "tenants", tenantId, "promotions"),
  };
}

export type TenantCollections = ReturnType<typeof tenantCollections>;
