import { collection, type Firestore } from "firebase/firestore";

/** Coleções globalmente escopadas pela tenancy. */
export const globalCollections = {
  users: (db: Firestore) => collection(db, "users"),
  tenants: (db: Firestore) => collection(db, "tenants"),
  tenantUsers: (db: Firestore) => collection(db, "tenant_users"),
  plans: (db: Firestore) => collection(db, "plans"),
  apiKeys: (db: Firestore) => collection(db, "api_keys"),
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
    branches: () => collection(db, "tenants", tenantId, "branches"),
    calendarIntegrations: () => collection(db, "tenants", tenantId, "calendar_integrations"),
    whatsappBot: () => collection(db, "tenants", tenantId, "whatsapp_bot"),
    automations: () => collection(db, "tenants", tenantId, "automations"),
    automationRuns: () => collection(db, "tenants", tenantId, "automation_runs"),
    packages: () => collection(db, "tenants", tenantId, "packages"),
    customerPackages: () => collection(db, "tenants", tenantId, "customer_packages"),
    subscriptionPlans: () => collection(db, "tenants", tenantId, "subscription_plans"),
    customerSubscriptions: () => collection(db, "tenants", tenantId, "customer_subscriptions"),
    products: () => collection(db, "tenants", tenantId, "products"),
    suppliers: () => collection(db, "tenants", tenantId, "suppliers"),
    stockMovements: () => collection(db, "tenants", tenantId, "stock_movements"),
    sales: () => collection(db, "tenants", tenantId, "sales"),
    apiKeys: () => collection(db, "tenants", tenantId, "api_keys"),
    apiKeyLogs: () => collection(db, "tenants", tenantId, "api_key_logs"),
    outboundWebhooks: () => collection(db, "tenants", tenantId, "outbound_webhooks"),
    webhookDeliveries: () => collection(db, "tenants", tenantId, "webhook_deliveries"),
    supportTickets: () => collection(db, "tenants", tenantId, "support_tickets"),
    supportMessages: () => collection(db, "tenants", tenantId, "support_messages"),
    impersonations: () => collection(db, "tenants", tenantId, "impersonations"),
    lgpdConsents: () => collection(db, "tenants", tenantId, "lgpd_consents"),
    jobs: () => collection(db, "tenants", tenantId, "jobs"),
  };
}

export type TenantCollections = ReturnType<typeof tenantCollections>;
