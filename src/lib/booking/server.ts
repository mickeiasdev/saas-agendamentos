import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { dayOfWeekOf, instantFromWallClock, minutesToTime, toMinutes, validateSlotAvailability, wallClockOf, DEFAULT_TZ } from "./timezone";
import { getPlan, checkLimit } from "@/lib/plans";
import { applyCoupon } from "@/lib/coupons";
import type { Appointment, Coupon, Holiday, Professional, ProfessionalAvailability, Service, Tenant } from "@/types";

export class BookingError extends Error {}

interface TenantWithId extends Tenant {
  id: string;
}

function toDateValue(v: unknown): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === "object" && typeof (v as { toDate?: unknown }).toDate === "function") {
    return (v as { toDate: () => Date }).toDate();
  }
  return new Date(String(v));
}

async function getDocData(
  db: Firestore,
  tenantId: string,
  collectionName: string,
  docId: string
): Promise<Record<string, unknown> | null> {
  const snap = await db.collection("tenants").doc(tenantId).collection(collectionName).doc(docId).get();
  return snap.exists ? snap.data() ?? null : null;
}

async function loadBookingContext(
  db: Firestore,
  tenantSlug: string,
  serviceId: string,
  professionalId: string
): Promise<{ tenant: TenantWithId; service: Service; professional: Professional; tz: string }> {
  const tenantSnap = await db.collection("tenants").where("slug", "==", tenantSlug).limit(1).get();
  if (tenantSnap.empty) throw new BookingError("Empresa não encontrada.");
  const tenant = { id: tenantSnap.docs[0].id, ...tenantSnap.docs[0].data() } as TenantWithId;
  if (tenant.status === "suspended") {
    throw new BookingError("Esta empresa está temporariamente suspensa.");
  }

  const service = (await getDocData(db, tenant.id, "services", serviceId)) as Service | null;
  if (!service || service.status !== "active") throw new BookingError("Serviço indisponível.");

  const professional = (await getDocData(db, tenant.id, "professionals", professionalId)) as Professional | null;
  if (!professional || !professional.active) throw new BookingError("Profissional indisponível.");
  if (service.professionals?.length && !service.professionals.includes(professionalId)) {
    throw new BookingError("Este profissional não realiza este serviço.");
  }

  const tz = tenant.settings?.timezone || DEFAULT_TZ;
  return { tenant, service, professional, tz };
}

async function loadSchedule(db: Firestore, tenantId: string, professionalId: string, date: string, tz: string) {
  const availabilityCol = db.collection("tenants").doc(tenantId).collection("availability");
  const availSnap = await availabilityCol.where("professionalId", "==", professionalId).limit(1).get();
  const availability = availSnap.empty
    ? null
    : ({ id: availSnap.docs[0].id, ...availSnap.docs[0].data() } as ProfessionalAvailability);

  const holidaysSnap = await db.collection("tenants").doc(tenantId).collection("holidays").get();
  const holidays = holidaysSnap.docs.map((d) => d.data() as Holiday);

  const dayStart = instantFromWallClock(date, "00:00", tz);
  const dayEnd = instantFromWallClock(date, "23:59", tz);
  const appCol = db.collection("tenants").doc(tenantId).collection("appointments");
  const appSnap = await appCol
    .where("professionalId", "==", professionalId)
    .where("startAt", "<", dayEnd)
    .where("endAt", ">", dayStart)
    .get();
  const appointments = appSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);

  return { availability, holidays, appointments };
}

export interface PublicSlotsResult {
  slots: string[];
  timezone: string;
}

export async function listPublicSlots(
  db: Firestore,
  input: { tenantSlug: string; serviceId: string; professionalId: string; date: string }
): Promise<PublicSlotsResult> {
  const { tenant, service, professional, tz } = await loadBookingContext(
    db,
    input.tenantSlug,
    input.serviceId,
    input.professionalId
  );
  const { availability, holidays, appointments } = await loadSchedule(
    db,
    tenant.id,
    professional.id,
    input.date,
    tz
  );

  if (!availability) return { slots: [], timezone: tz };

  const dow = dayOfWeekOf(input.date);

  if (holidays.some((h) => h.date === input.date)) return { slots: [], timezone: tz };
  if (availability.daysOff.includes(input.date)) return { slots: [], timezone: tz };
  if (availability.blockedDates.includes(input.date)) return { slots: [], timezone: tz };
  if (availability.vacations.some((v) => input.date >= v.startDate && input.date <= v.endDate)) {
    return { slots: [], timezone: tz };
  }

  const workDay = availability.workDays.find((w) => w.dayOfWeek === dow);
  if (!workDay || !workDay.enabled) return { slots: [], timezone: tz };

  let dayStart = toMinutes(workDay.startTime);
  let dayEnd = toMinutes(workDay.endTime);
  const exception = availability.exceptions.find((e) => e.date === input.date);
  if (exception) {
    if (exception.startTime && exception.endTime) {
      dayStart = toMinutes(exception.startTime);
      dayEnd = toMinutes(exception.endTime);
    } else {
      return { slots: [], timezone: tz };
    }
  }

  const slotInterval = tenant.settings?.slotIntervalMinutes ?? 30;
  const duration = service.durationMinutes;

  const occupied = appointments
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show")
    .map((a) => {
      const st = wallClockOf(toDateValue(a.startAt), tz);
      const en = wallClockOf(toDateValue(a.endAt), tz);
      return [toMinutes(st.time), toMinutes(en.time)] as [number, number];
    });

  const nowMs = Date.now();
  const slots: string[] = [];
  for (let t = dayStart; t + duration <= dayEnd; t += slotInterval) {
    const time = minutesToTime(t);
    const instant = instantFromWallClock(input.date, time, tz);
    if (instant.getTime() <= nowMs) continue;

    const valid = validateSlotAvailability({
      availability,
      holidays,
      durationMinutes: duration,
      instant,
      tz,
    });
    if (!valid.ok) continue;

    const overlaps = occupied.some(([s, e]) => t < e && s < t + duration);
    if (overlaps) continue;

    slots.push(time);
  }

  return { slots, timezone: tz };
}

async function getMonthAppointmentCount(db: Firestore, tenantId: string, startAt: Date): Promise<number> {
  const first = new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth(), 1));
  const next = new Date(Date.UTC(startAt.getUTCFullYear(), startAt.getUTCMonth() + 1, 1));
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("appointments")
    .where("startAt", ">=", first)
    .where("startAt", "<", next)
    .where("status", "in", ["pending", "confirmed", "in_progress", "completed"])
    .count()
    .get();
  return snap.data().count;
}

async function upsertCustomerForBooking(
  db: Firestore,
  tenantId: string,
  customer: PublicBookingInput["customer"]
): Promise<string> {
  const col = db.collection("tenants").doc(tenantId).collection("customers");
  if (customer.phone) {
    const snap = await col.where("phone", "==", customer.phone).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  if (customer.email) {
    const snap = await col.where("email", "==", customer.email).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
  }
  const ref = await col.add({
    tenantId,
    name: customer.name,
    phone: customer.phone ?? null,
    whatsapp: customer.phone ?? null,
    email: customer.email ?? null,
    birthDate: null,
    gender: null,
    notes: null,
    tags: [],
    source: "site",
    totalSpent: 0,
    visitCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

async function getCouponByCode(db: Firestore, tenantId: string, code: string): Promise<{ id: string } | null> {
  const snap = await db
    .collection("tenants")
    .doc(tenantId)
    .collection("coupons")
    .where("code", "==", code.trim().toUpperCase())
    .limit(1)
    .get();
  return snap.empty ? null : { id: snap.docs[0].id };
}

async function createNotification(
  db: Firestore,
  tenantId: string,
  input: { type: string; title: string; body: string }
): Promise<void> {
  await db.collection("tenants").doc(tenantId).collection("notifications").add({
    tenantId,
    userId: null,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export interface PublicBookingInput {
  tenantSlug: string;
  serviceId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  couponCode?: string;
  notes?: string;
  customer: { name: string; phone?: string; email?: string };
}

export interface BookingResult {
  appointmentId: string;
  customerId: string;
  price: number;
  couponApplied: boolean;
}

export async function createPublicAppointment(
  db: Firestore,
  input: PublicBookingInput
): Promise<BookingResult> {
  const { tenant, service, professional, tz } = await loadBookingContext(
    db,
    input.tenantSlug,
    input.serviceId,
    input.professionalId
  );

  const startAt = instantFromWallClock(input.date, input.time, tz);
  const leadTime = tenant.settings?.bookingLeadTimeMinutes ?? 0;
  if (startAt.getTime() <= Date.now() + leadTime * 60000) {
    throw new BookingError(
      leadTime > 0
        ? `Os agendamentos devem ser feitos com pelo menos ${leadTime} minuto(s) de antecedência.`
        : "Não é possível agendar em um horário que já passou."
    );
  }
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);

  const monthCount = await getMonthAppointmentCount(db, tenant.id, startAt);
  const plan = getPlan(tenant.planId ?? "FREE");
  const limitCheck = checkLimit(
    monthCount,
    plan.limits.maxAppointmentsPerMonth,
    "agendamentos mensais"
  );
  if (!limitCheck.ok) throw new BookingError(limitCheck.message ?? "Limite do plano atingido.");

  const { availability, holidays } = await loadSchedule(db, tenant.id, professional.id, input.date, tz);
  const customerId = await upsertCustomerForBooking(db, tenant.id, input.customer);

  const col = db.collection("tenants").doc(tenant.id).collection("appointments");
  const slotId = `${input.professionalId}_${startAt.getTime()}`;
  const ref = col.doc(slotId);
  const couponRef = input.couponCode
    ? db.collection("tenants").doc(tenant.id).collection("coupons").doc((await getCouponByCode(db, tenant.id, input.couponCode))?.id ?? "-")
    : null;

  let finalPrice = service.price;
  let couponApplied = false;

  const cancelWindow = tenant.settings?.bookingCancelWindowMinutes ?? 0;
  const cancelWindowDeadline = cancelWindow > 0
    ? new Date(startAt.getTime() - cancelWindow * 60000)
    : null;
  const needsConfirmation = tenant.settings?.confirmationRequired ?? false;

  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) {
      throw new BookingError("Horário indisponível: este horário acabou de ser reservado por outra pessoa.");
    }

    const valid = validateSlotAvailability({
      availability,
      holidays,
      durationMinutes: service.durationMinutes,
      instant: startAt,
      tz,
    });
    if (!valid.ok) throw new BookingError(valid.reason ?? "Horário indisponível.");

    const overlap = await tx.get(
      col
        .where("professionalId", "==", professional.id)
        .where("startAt", "<", endAt)
        .where("endAt", ">", startAt)
    );
    if (!overlap.empty) {
      throw new BookingError("Horário indisponível: já existe um agendamento neste intervalo.");
    }

    let price = service.price;
    if (couponRef) {
      const couponSnap = await tx.get(couponRef);
      if (!couponSnap.exists) throw new BookingError("Cupom não encontrado.");
      const applied = applyCoupon({ coupon: couponSnap.data() as Coupon, basePrice: service.price });
      if (!applied.ok) throw new BookingError(applied.reason ?? "Cupom inválido.");
      price = applied.discountedPrice ?? price;
      tx.update(couponRef, { usedCount: FieldValue.increment(1) });
      couponApplied = true;
    }

  tx.set(ref, {
    professionalId: professional.id,
    serviceId: service.id,
    customerId,
    startAt,
    endAt,
    status: needsConfirmation ? "pending" : "confirmed",
    paymentStatus: "pending",
    price,
    notes: input.notes ?? null,
    cancelWindowDeadline,
    createdBy: "customer",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  finalPrice = price;
  });
  const confirmedLabel = needsConfirmation ? "aguardando confirmação" : "confirmado";

  await createNotification(db, tenant.id, {
    type: needsConfirmation ? "appointment" : "confirmation",
    title: "Novo agendamento no site",
    body: `${input.customer.name} reservou ${service.name} com ${professional.name} em ${input.date} às ${input.time} (${confirmedLabel}).`,
  });

  return { appointmentId: slotId, customerId, price: finalPrice, couponApplied };
}
