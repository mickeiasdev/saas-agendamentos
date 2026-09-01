import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { Appointment, AppointmentStatus, Customer, Professional, Service, Tenant } from "@/types";
import {
  BookingError,
  createPublicAppointment,
  type BookingResult,
  type PublicBookingInput,
} from "@/lib/booking/server";

/**
 * API Pública (Fase 3.12) — operações de dados via Admin SDK.
 *
 * Endpoints expostos: GET/POST appointments, GET/POST customers, GET services,
 * GET professionals. As operações listadas usam o Firestore diretamente; a
 * criação de agendamento reaproveita o motor de booking (regras de
 * disponibilidade, cupons e limites) para não duplicar regras de negócio.
 */

export class ApiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiValidationError";
  }
}

function toMillis(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof v === "number") return v;
  const ms = new Date(String(v)).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function clampSize(v: number | undefined): number {
  if (!v || Number.isNaN(v)) return 50;
  return Math.min(Math.max(Math.trunc(v), 1), 100);
}

function parseDateParam(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ---------- Services ----------

export async function apiListServices(db: Firestore, tenantId: string): Promise<Service[]> {
  const snap = await db.collection("tenants").doc(tenantId).collection("services").limit(500).get();
  return snap.docs
    .map((d) => ({ id: d.id, tenantId, ...d.data() }) as Service)
    .filter((s) => s.status === "active");
}

// ---------- Professionals ----------

export async function apiListProfessionals(db: Firestore, tenantId: string): Promise<Professional[]> {
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("professionals")
    .limit(500)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, tenantId, ...d.data() }) as Professional)
    .filter((p) => p.active);
}

// ---------- Customers ----------

function matchesCustomerSearch(c: Customer, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  return (
    c.name.toLowerCase().includes(t) ||
    (c.email ?? "").toLowerCase().includes(t) ||
    (digits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(digits)) ||
    (digits.length > 0 && (c.whatsapp ?? "").replace(/\D/g, "").includes(digits))
  );
}

export interface ApiCustomerPage {
  items: Customer[];
  nextCursor: string | null;
}

export async function apiListCustomers(
  db: Firestore,
  tenantId: string,
  opts: { limit?: number; cursor?: string; search?: string } = {}
): Promise<ApiCustomerPage> {
  const size = clampSize(opts.limit);
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("customers")
    .orderBy("name")
    .limit(500)
    .get();
  let items = snap.docs.map((d) => ({ id: d.id, tenantId, ...d.data() }) as Customer);

  if (opts.cursor) items = items.filter((c) => c.name > (opts.cursor as string));
  if (opts.search) items = items.filter((c) => matchesCustomerSearch(c, opts.search as string));

  const page = items.slice(0, size);
  return {
    items: page,
    nextCursor: page.length === size ? page[page.length - 1].name : null,
  };
}

export interface CreateCustomerApiInput {
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  birthDate?: string;
  gender?: string;
  notes?: string;
  tags?: string[];
  source?: string;
}

export async function apiCreateCustomer(
  db: Firestore,
  tenantId: string,
  input: CreateCustomerApiInput
): Promise<{ id: string }> {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) throw new ApiValidationError("O campo 'name' é obrigatório.");

  const ref = await db.collection("tenants").doc(tenantId).collection("customers").add({
    tenantId,
    name,
    email: typeof input.email === "string" ? input.email.trim() : null,
    phone: typeof input.phone === "string" ? input.phone.trim() : null,
    whatsapp: typeof input.whatsapp === "string" ? input.whatsapp.trim() : null,
    birthDate: typeof input.birthDate === "string" ? input.birthDate : null,
    gender: typeof input.gender === "string" ? input.gender : null,
    notes: typeof input.notes === "string" ? input.notes : null,
    tags: Array.isArray(input.tags) ? input.tags.map(String) : [],
    source: typeof input.source === "string" ? input.source : "api",
    totalSpent: 0,
    visitCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { id: ref.id };
}

// ---------- Appointments ----------

export interface ApiAppointmentPage {
  items: Appointment[];
}

export async function apiListAppointments(
  db: Firestore,
  tenantId: string,
  opts: { limit?: number; status?: string; from?: string; to?: string } = {}
): Promise<ApiAppointmentPage> {
  const size = clampSize(opts.limit);
  const col = db.collection("tenants").doc(tenantId).collection("appointments");

  let q: ReturnType<typeof col.where> | typeof col = col;
  if (opts.status && (["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"] as string[]).includes(opts.status)) {
    q = col.where("status", "==", opts.status);
  }
  q = q.orderBy("startAt", "desc").limit(size);
  const snap = await q.get();
  let items = snap.docs.map((d) => ({ id: d.id, tenantId, ...d.data() }) as Appointment);

  const from = parseDateParam(opts.from ?? null);
  const to = parseDateParam(opts.to ?? null);
  if (from) items = items.filter((a) => toMillis(a.startAt) >= from.getTime());
  if (to) items = items.filter((a) => toMillis(a.startAt) <= to.getTime());

  return { items };
}

export interface CreateAppointmentApiInput {
  serviceId?: string;
  professionalId?: string;
  date?: string;
  time?: string;
  couponCode?: string;
  notes?: string;
  customer?: { name?: string; phone?: string; email?: string };
}

export async function apiCreateAppointment(
  db: Firestore,
  tenantId: string,
  input: CreateAppointmentApiInput
): Promise<BookingResult> {
  const tenantSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnap.exists) throw new ApiValidationError("Empresa não encontrada.");
  const tenant = tenantSnap.data() as Tenant;
  if (!tenant.slug) throw new ApiValidationError("Empresa sem slug configurado.");

  const customerName = typeof input.customer?.name === "string" ? input.customer.name.trim() : "";
  if (!customerName) throw new ApiValidationError("O campo 'customer.name' é obrigatório.");

  const payload: PublicBookingInput = {
    tenantSlug: tenant.slug,
    serviceId: input.serviceId ?? "",
    professionalId: input.professionalId ?? "",
    date: input.date ?? "",
    time: input.time ?? "",
    customer: {
      name: customerName,
      phone: input.customer?.phone,
      email: input.customer?.email,
    },
  };
  if (input.couponCode) payload.couponCode = input.couponCode;
  if (input.notes) payload.notes = input.notes;

  try {
    return await createPublicAppointment(db, payload);
  } catch (err) {
    if (err instanceof BookingError) throw err;
    throw err;
  }
}

export { BookingError };
