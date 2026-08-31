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
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  ownerUserId: string;
  settings: TenantSettings;
  branding: TenantBranding;
  featureFlags: FeatureFlags;
  limits: PlanLimits;
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

export type TimestampLike = Date | {
  seconds?: number;
  nanoseconds?: number;
  toDate?: () => Date;
};
