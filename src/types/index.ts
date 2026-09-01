export type Role =
  | "PLATFORM_OWNER"
  | "PLATFORM_ADMIN"
  | "TENANT_OWNER"
  | "TENANT_ADMIN"
  | "MANAGER"
  | "PROFESSIONAL"
  | "CUSTOMER";

export type TenantStatus = "active" | "trial" | "suspended" | "pending";
export type SubscriptionStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
export type PlanId = "ALL";

export type SegmentId =
  | "barber"
  | "salon"
  | "aesthetics"
  | "clinic"
  | "dental"
  | "personal"
  | "tattoo"
  | "photography"
  | "workshop"
  | "pet"
  | "services"
  | "other";

export interface Address {
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  tradeName?: string;
  cnpjCpf?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: Address;
  instagram?: string;
  description?: string;
  logoUrl?: string;
  bannerUrl?: string;
  segmentId?: SegmentId;
  planId: PlanId;
  status: TenantStatus;
  subscriptionStatus: SubscriptionStatus;
  subscriptionEndsAt?: TimestampLike | null;
  customDomain?: CustomDomain | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  ownerUserId: string;
  settings: TenantSettings;
  branding: TenantBranding;
  featureFlags: FeatureFlags;
  limits: PlanLimits;
}

// ---------- FASE 3: DOMÍNIO PERSONALIZADO (3.2) ----------

export interface CustomDomain {
  host: string; // www.cliente.com.br
  verified: boolean;
  verificationToken?: string;
  requestedAt?: TimestampLike | null;
  verifiedAt?: TimestampLike | null;
}

export interface TenantSettings {
  timezone: string;
  currency: string;
  slotIntervalMinutes: number;
  bookingLeadTimeMinutes: number;
  bookingCancelWindowMinutes: number;
  confirmationRequired: boolean;
  allowOnlinePayments: boolean;
}

export interface TenantBranding {
  primaryColor: string;
  secondaryColor: string;
  font?: string;
  theme: "light" | "dark";
  bannerUrl?: string;
  galleryUrls: string[];
  testimonials: Testimonial[];
  faq: FaqItem[];
  socialLinks: Record<string, string>;
  showContact: boolean;
  showLocation: boolean;
  sectionOrder: string[];
}

export interface Testimonial {
  id: string;
  author: string;
  text: string;
  rating: number;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FeatureFlags {
  payments: boolean;
  whatsapp: boolean;
  customDomain: boolean;
  reports: boolean;
  loyalty: boolean;
  inventory: boolean;
  multiBranch: boolean;
  api: boolean;
}

export interface PlanLimits {
  maxProfessionals: number;
  maxCustomers: number;
  maxAppointmentsPerMonth: number;
  maxStorageGb: number;
  maxBranches: number;
}

export interface TenantUser {
  userId: string;
  tenantId: string;
  role: Role;
  status: "active" | "invited" | "disabled";
  displayName?: string;
  photoUrl?: string;
  createdAt: TimestampLike;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoUrl?: string;
  phone?: string;
  platformRole: "PLATFORM_OWNER" | "PLATFORM_ADMIN" | "USER";
  activeTenantId?: string;
  createdAt: TimestampLike;
}

export interface Category {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  order: number;
  status: "active" | "inactive";
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type ServiceStatus = "active" | "inactive";

export interface Service {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  categoryId?: string;
  imageUrl?: string;
  status: ServiceStatus;
  commissionPercent?: number;
  requiresProfessional: boolean;
  professionals?: string[];
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface Professional {
  id: string;
  tenantId: string;
  name: string;
  photoUrl?: string;
  description?: string;
  phone?: string;
  email?: string;
  color: string;
  active: boolean;
  serviceIds: string[];
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WorkDay {
  dayOfWeek: DayOfWeek;
  enabled: boolean;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  breaks: TimeRange[];
}

export interface TimeRange {
  start: string; // "HH:mm"
  end: string; // "HH:mm"
}

export interface Holiday {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface ExceptionDay {
  id: string;
  tenantId: string;
  date: string; // YYYY-MM-DD
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface ProfessionalAvailability {
  id: string;
  tenantId: string;
  professionalId: string;
  workDays: WorkDay[];
  daysOff: string[]; // date list YYYY-MM-DD (folgas)
  vacations: VacationPeriod[];
  blockedDates: string[]; // bloqueios
  exceptions: ExceptionDay[];
  updatedAt: TimestampLike;
}

export interface VacationPeriod {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
}

export type AppointmentStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  tenantId: string;
  professionalId: string;
  serviceId: string;
  customerId: string;
  startAt: TimestampLike; // server timestamp of slot start
  endAt: TimestampLike;
  status: AppointmentStatus;
  price: number;
  paymentStatus: "pending" | "paid" | "partial" | "refunded";
  notes?: string;
  cancellationReason?: string;
  cancelWindowDeadline?: TimestampLike | null;
  rescheduledTo?: string;
  createdBy: "customer" | "professional" | "manager" | "owner";
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface Customer {
  id: string;
  tenantId: string;
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  birthDate?: string;
  gender?: string;
  notes?: string;
  tags: string[];
  source?: string;
  totalSpent: number;
  visitCount: number;
  lastVisitAt?: TimestampLike | null;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface Coupon {
  id: string;
  tenantId: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minValue?: number;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  usedCount: number;
  active: boolean;
}

export interface Review {
  id: string;
  tenantId: string;
  appointmentId: string;
  customerId: string;
  rating: number;
  comment?: string;
  createdAt: TimestampLike;
}

export interface Payment {
  id: string;
  tenantId: string;
  appointmentId: string;
  amount: number;
  status: "pending" | "approved" | "refunded" | "failed";
  method: "pix" | "card" | "cash" | "signal" | "other";
  gateway: string;
  gatewayReference?: string;
  metadata?: Record<string, unknown>;
  createdAt: TimestampLike;
}

export interface Notification {
  id: string;
  tenantId: string;
  userId?: string;
  type: "appointment" | "confirmation" | "cancellation" | "payment" | "reminder" | "system";
  title: string;
  body: string;
  read: boolean;
  createdAt: TimestampLike;
}

export interface AuditLog {
  id: string;
  tenantId?: string;
  userId: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  createdAt: TimestampLike;
}

export interface Slot {
  start: Date;
  end: Date;
  professionalId: string;
  available: boolean;
}

// ---------- FASE 2: ASSINATURAS ----------

export interface Subscription {
  id: string;
  tenantId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  startedAt: TimestampLike;
  trialEndsAt?: TimestampLike | null;
  currentPeriodStart: TimestampLike;
  currentPeriodEnd: TimestampLike;
  cancelAtPeriodEnd: boolean;
  canceledAt?: TimestampLike | null;
  updatedAt: TimestampLike;
}

// ---------- FASE 2: WEBHOOKS ----------

export interface WebhookEvent {
  id: string;
  tenantId: string;
  source: string;
  event: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  status: "received" | "processing" | "processed" | "failed";
  attempts: number;
  lastError?: string;
  processedAt?: TimestampLike | null;
  createdAt: TimestampLike;
}

// ---------- FASE 2: FIDELIDADE ----------

export interface LoyaltyReward {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  pointsCost: number;
  active: boolean;
  createdAt: TimestampLike;
}

export interface LoyaltyAccount {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  points: number;
  pointsEarned: number;
  pointsSpent: number;
  updatedAt: TimestampLike;
}

export interface LoyaltyTransaction {
  id: string;
  tenantId: string;
  customerId: string;
  type: "earn" | "redeem";
  points: number;
  description: string;
  appointmentId?: string;
  rewardId?: string;
  createdAt: TimestampLike;
}

// ---------- FASE 2: FINANCEIRO ----------

export type FinancialEntryType = "income" | "expense";

export type FinancialCategory =
  | "appointments"
  | "products"
  | "packages"
  | "other_income"
  | "expenses"
  | "suppliers"
  | "salaries"
  | "other_expense";

export interface FinancialEntry {
  id: string;
  tenantId: string;
  type: FinancialEntryType;
  category: FinancialCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  sourceId?: string;
  sourceType?: "appointment" | "product" | "package" | "supplier" | "employee" | "other";
  createdAt: TimestampLike;
}

// ---------- FASE 2: PROMOÇÕES ----------

export type PromotionType = "first_visit" | "off_peak" | "combo" | "service";

export interface Promotion {
  id: string;
  tenantId: string;
  name: string;
  type: PromotionType;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
  serviceId?: string;
  comboServiceIds?: string[];
  offPeakDays?: DayOfWeek[];
  offPeakStartTime?: string;
  offPeakEndTime?: string;
  validFrom?: string;
  validUntil?: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type TimestampLike = Date | {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
};

// ---------- FASE 3: MULTIUNIDADES (3.1) ----------

export interface Branch {
  id: string;
  tenantId: string;
  name: string;
  address?: Address;
  phone?: string;
  whatsapp?: string;
  email?: string;
  active: boolean;
  isMain: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- FASE 3: CALENDÁRIOS (3.5) ----------

export type CalendarProviderType = "google" | "outlook";

export interface CalendarIntegration {
  id: string;
  tenantId: string;
  provider: CalendarProviderType;
  enabled: boolean;
  connectedAt?: TimestampLike | null;
  accountEmail?: string;
  syncAppointments: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- FASE 3: BOT WHATSAPP (3.6) ----------

export interface WhatsAppBotConfig {
  id: string;
  tenantId: string;
  enabled: boolean;
  provider: string;
  welcomeMessage: string;
  autoReply: boolean;
  allowBooking: boolean;
  workingHoursOnly: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- FASE 3: MARKETING AUTOMÁTICO (3.7) ----------

export type AutomationTrigger =
  | "customer_inactive"
  | "birthday"
  | "appointment_tomorrow"
  | "appointment_completed";

export type AutomationChannel = "notification" | "email" | "whatsapp";

export interface Automation {
  id: string;
  tenantId: string;
  name: string;
  trigger: AutomationTrigger;
  channel: AutomationChannel;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type AutomationRunStatus = "pending" | "sent" | "skipped" | "failed";

export interface AutomationRun {
  id: string;
  tenantId: string;
  automationId: string;
  targetId: string;
  status: AutomationRunStatus;
  executedAt?: TimestampLike | null;
  error?: string;
  createdAt: TimestampLike;
}

// ---------- FASE 3: PACOTES (3.8) ----------

export interface PackageItem {
  serviceId: string;
  serviceName: string;
  quantity: number;
}

export interface ServicePackage {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  items: PackageItem[];
  price: number;
  validDays?: number;
  active: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type CustomerPackageStatus = "active" | "expired" | "used";

export interface CustomerPackageItem {
  serviceId: string;
  serviceName: string;
  total: number;
  used: number;
}

export interface CustomerPackage {
  id: string;
  tenantId: string;
  packageId: string;
  packageName: string;
  customerId: string;
  customerName: string;
  items: CustomerPackageItem[];
  price: number;
  purchasedAt: TimestampLike;
  expiresAt?: TimestampLike | null;
  status: CustomerPackageStatus;
  createdAt: TimestampLike;
}

// ---------- FASE 3: ASSINATURAS DOS CLIENTES (3.9) ----------

export type BillingCycle = "weekly" | "monthly" | "quarterly" | "yearly";

export interface CustomerSubscriptionPlan {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  price: number;
  billingCycle: BillingCycle;
  appointmentsIncluded: number;
  active: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type CustomerSubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

export interface CustomerSubscription {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  customerId: string;
  customerName: string;
  price: number;
  billingCycle: BillingCycle;
  appointmentsIncluded: number;
  appointmentsUsed: number;
  cycleStart: TimestampLike;
  cycleEnd: TimestampLike;
  status: CustomerSubscriptionStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- FASE 3: ESTOQUE (3.10) ----------

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  sku?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  unit?: string;
  supplierId?: string;
  active: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface Supplier {
  id: string;
  tenantId: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  createdAt: TimestampLike;
}

export type StockMovementType = "in" | "out" | "adjustment";

export interface StockMovement {
  id: string;
  tenantId: string;
  productId: string;
  productName: string;
  type: StockMovementType;
  quantity: number;
  reason?: string;
  sourceId?: string;
  sourceType?: "purchase" | "sale" | "adjustment";
  createdAt: TimestampLike;
}

// ---------- FASE 3: VENDAS (3.11) ----------

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

export type SaleStatus = "completed" | "cancelled" | "refunded";

export interface Sale {
  id: string;
  tenantId: string;
  items: SaleItem[];
  total: number;
  discount: number;
  customerId?: string;
  customerName?: string;
  paymentMethod: "cash" | "pix" | "card" | "other";
  status: SaleStatus;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

// ---------- FASE 3: API KEYS (3.13) ----------

export type ApiKeyScope =
  | "appointments:read"
  | "appointments:write"
  | "customers:read"
  | "customers:write"
  | "services:read"
  | "professionals:read";

export interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  keyHash: string;
  scopes: ApiKeyScope[];
  active: boolean;
  expiresAt?: TimestampLike | null;
  lastUsedAt?: TimestampLike | null;
  createdAt: TimestampLike;
  revokedAt?: TimestampLike | null;
}

export interface ApiKeyLog {
  id: string;
  tenantId: string;
  apiKeyId: string;
  method: string;
  path: string;
  status: number;
  ip?: string;
  createdAt: TimestampLike;
}

// ---------- FASE 3: WEBHOOKS PÚBLICOS (3.14) ----------

export interface OutboundWebhook {
  id: string;
  tenantId: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export type DeliveryStatus = "pending" | "delivered" | "failed";

export interface OutboundWebhookDelivery {
  id: string;
  tenantId: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  status: DeliveryStatus;
  attempts: number;
  lastError?: string;
  deliveredAt?: TimestampLike | null;
  createdAt: TimestampLike;
}

// ---------- FASE 3: SUPORTE (3.15) ----------

export type SupportTicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type SupportTicketPriority = "low" | "normal" | "high" | "urgent";

export interface SupportTicket {
  id: string;
  tenantId: string;
  subject: string;
  category?: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  createdBy: string;
  createdByName?: string;
  assignedTo?: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}

export interface SupportMessage {
  id: string;
  tenantId: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: TimestampLike;
}

// ---------- FASE 3: IMPERSONATION (3.16) ----------

export interface ImpersonationSession {
  id: string;
  adminUid: string;
  adminEmail?: string;
  tenantId: string;
  reason: string;
  startedAt: TimestampLike;
  endedAt?: TimestampLike | null;
  status: "active" | "ended";
}

// ---------- FASE 3: LGPD (3.19) ----------

export type ConsentType = "policy" | "terms" | "marketing" | "data_processing";

export interface LgpdConsent {
  id: string;
  tenantId: string;
  subject: "customer" | "user";
  subjectId: string;
  consentType: ConsentType;
  granted: boolean;
  grantedAt?: TimestampLike | null;
  revokedAt?: TimestampLike | null;
  createdAt: TimestampLike;
}

// ---------- FASE 3: FILAS/JOBS (3.23) ----------

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  tenantId?: string;
  type: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: TimestampLike;
  lastError?: string;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
}
