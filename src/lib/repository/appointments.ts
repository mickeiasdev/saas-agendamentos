import {
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import { DEFAULT_TZ, validateSlotAvailability } from "@/lib/booking/timezone";
import { asOverlapCandidate, findBlockingOverlaps, isBlockingStatus, overlapLookback } from "./overlap";
import type { Appointment, Holiday, Professional, ProfessionalAvailability, Service, Tenant } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).appointments();

export async function listAppointments(
  tenantId: string,
  opts: { from: Date; to: Date; professionalId?: string; status?: string } = {
    from: new Date(0),
    to: new Date(8640000000000000),
  }
): Promise<Appointment[]> {
  const constraints: QueryConstraint[] = [];
  if (opts.professionalId) {
    constraints.push(where("professionalId", "==", opts.professionalId));
  }
  constraints.push(
    where("startAt", ">=", opts.from),
    where("startAt", "<=", opts.to),
    orderBy("startAt"),
    limit(500)
  );
  const snap = await getDocs(query(collectionFor(tenantId), ...constraints));
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);
  if (opts.status) list = list.filter((a) => a.status === opts.status);
  return list;
}

export async function listAppointmentsByRange(
  tenantId: string,
  from: Date,
  to: Date
): Promise<Appointment[]> {
  const q = query(
    collectionFor(tenantId),
    where("startAt", ">=", from),
    where("startAt", "<=", to),
    orderBy("startAt")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);
}

export interface CreateAppointmentInput {
  tenantId: string;
  professionalId: string;
  serviceId: string;
  customerId: string;
  startAt: Date;
  endAt: Date;
  price: number;
  notes?: string;
  createdBy: "customer" | "professional" | "manager" | "owner";
}

function appointmentDocFromInput(input: CreateAppointmentInput): Record<string, unknown> {
  return {
    tenantId: input.tenantId,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    customerId: input.customerId,
    startAt: input.startAt,
    endAt: input.endAt,
    status: "pending",
    paymentStatus: "pending",
    price: input.price,
    notes: input.notes,
    createdBy: input.createdBy,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

async function loadStaffBookingContext(tenantId: string, professionalId: string, serviceId: string) {
  const db = getFirebaseFirestore();
  const cols = tenantCollections(db, tenantId);

  const [tenantSnap, proSnap, svcSnap] = await Promise.all([
    getDoc(doc(db, "tenants", tenantId)),
    getDoc(doc(cols.professionals(), professionalId)),
    getDoc(doc(cols.services(), serviceId)),
  ]);
  if (!tenantSnap.exists()) throw new Error("Empresa não encontrada.");
  const tenant = tenantSnap.data() as Tenant;
  if (!proSnap.exists()) throw new Error("Profissional não encontrado.");
  const professional = { id: proSnap.id, ...proSnap.data() } as Professional;
  if (!professional.active) throw new Error("Profissional indisponível.");
  if (!svcSnap.exists()) throw new Error("Serviço não encontrado.");
  const service = { id: svcSnap.id, ...svcSnap.data() } as Service;
  if (service.status !== "active") throw new Error("Serviço indisponível.");
  if (service.professionals?.length && !service.professionals.includes(professionalId)) {
    throw new Error("Este profissional não realiza este serviço.");
  }

  const avSnap = await getDocs(query(cols.availability(), where("professionalId", "==", professionalId)));
  const availability = avSnap.empty
    ? null
    : ({ id: avSnap.docs[0].id, ...avSnap.docs[0].data() } as ProfessionalAvailability);

  const holidaysSnap = await getDocs(cols.holidays());
  const holidays = holidaysSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Holiday);
  const tz = tenant.settings?.timezone || DEFAULT_TZ;

  return { db, tenant, professional, service, availability, holidays, tz };
}

/**
 * Cria um agendamento com PREVENÇÃO DE DOUBLE BOOKING.
 *
 * Valida expediente, intervalo, folga, férias, feriado e profissional
 * indisponível. A checagem de overlap roda DENTRO da transação Firestore
 * (não só o slot-id determinístico).
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<string> {
  const { db, availability, holidays, tz } = await loadStaffBookingContext(
    input.tenantId,
    input.professionalId,
    input.serviceId
  );

  const valid = validateSlotAvailability({
    availability,
    holidays,
    durationMinutes: Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000),
    instant: input.startAt,
    tz,
  });
  if (!valid.ok) throw new Error(valid.reason ?? "Horário indisponível.");

  const cols = tenantCollections(db, input.tenantId);
  const appointmentsCol = cols.appointments();
  const slotId = `${input.professionalId}_${input.startAt.getTime()}`;
  const ref = doc(appointmentsCol, slotId);
  const lockRef = availability ? doc(cols.availability(), availability.id) : null;

  await runTransaction(db, async (tx) => {
    if (lockRef) await tx.get(lockRef);
    const existing = await tx.get(ref);
    if (existing.exists() && isBlockingStatus((existing.data() as Appointment).status)) {
      throw new Error("Horário indisponível: este horário acabou de ser reservado.");
    }

    const overlapQuery = query(
      appointmentsCol,
      where("professionalId", "==", input.professionalId),
      where("startAt", ">=", overlapLookback(input.startAt)),
      where("startAt", "<", input.endAt)
    );
    const overlapSnap = await getDocs(overlapQuery);
    const locked = [];
    for (const d of overlapSnap.docs) {
      const fresh = await tx.get(d.ref);
      if (!fresh.exists()) continue;
      locked.push(asOverlapCandidate(fresh.id, fresh.data() as Appointment));
    }
    const overlaps = findBlockingOverlaps(locked, input.startAt, input.endAt, [slotId]);
    if (overlaps.length > 0) {
      throw new Error("Horário indisponível: já existe um agendamento neste intervalo.");
    }

    tx.set(ref, appointmentDocFromInput(input));
  });

  return ref.id;
}

export async function updateAppointmentStatus(
  tenantId: string,
  id: string,
  status: Appointment["status"],
  extra: { cancellationReason?: string } = {}
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (status === "cancelled") {
    patch.cancellationReason = extra.cancellationReason ?? "cancelado";
  }
  await updateDoc(doc(collectionFor(tenantId), id), patch);
}

export interface RescheduleAppointmentInput {
  tenantId: string;
  appointmentId: string;
  professionalId: string;
  serviceId: string;
  startAt: Date;
  endAt: Date;
}

export async function rescheduleAppointment(input: RescheduleAppointmentInput): Promise<string> {
  const { db, availability, holidays, tz } = await loadStaffBookingContext(
    input.tenantId,
    input.professionalId,
    input.serviceId
  );

  const valid = validateSlotAvailability({
    availability,
    holidays,
    durationMinutes: Math.round((input.endAt.getTime() - input.startAt.getTime()) / 60000),
    instant: input.startAt,
    tz,
  });
  if (!valid.ok) throw new Error(valid.reason ?? "Horário indisponível.");

  const cols = tenantCollections(db, input.tenantId);
  const appointmentsCol = cols.appointments();
  const oldRef = doc(appointmentsCol, input.appointmentId);
  const newId = `${input.professionalId}_${input.startAt.getTime()}`;
  const newRef = doc(appointmentsCol, newId);
  const lockRef = availability ? doc(cols.availability(), availability.id) : null;

  await runTransaction(db, async (tx) => {
    if (lockRef) await tx.get(lockRef);
    const oldSnap = await tx.get(oldRef);
    if (!oldSnap.exists()) throw new Error("Agendamento não encontrado.");
    const current = oldSnap.data() as Appointment;
    if (current.status === "cancelled" || current.status === "completed" || current.status === "no_show") {
      throw new Error("Este agendamento não pode ser remarcado.");
    }

    if (oldRef.id !== newRef.id) {
      const existing = await tx.get(newRef);
      if (existing.exists() && isBlockingStatus((existing.data() as Appointment).status)) {
        throw new Error("Horário indisponível: este horário acabou de ser reservado.");
      }
    }

    const overlapQuery = query(
      appointmentsCol,
      where("professionalId", "==", input.professionalId),
      where("startAt", ">=", overlapLookback(input.startAt)),
      where("startAt", "<", input.endAt)
    );
    const overlapSnap = await getDocs(overlapQuery);
    const locked = [];
    for (const d of overlapSnap.docs) {
      const fresh = await tx.get(d.ref);
      if (!fresh.exists()) continue;
      locked.push(asOverlapCandidate(fresh.id, fresh.data() as Appointment));
    }
    const overlaps = findBlockingOverlaps(locked, input.startAt, input.endAt, [input.appointmentId, newId]);
    if (overlaps.length > 0) {
      throw new Error("Horário indisponível: já existe um agendamento neste intervalo.");
    }

    const payload = {
      ...current,
      professionalId: input.professionalId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: input.endAt,
      status: current.status === "pending" ? "pending" : "confirmed",
      updatedAt: serverTimestamp(),
    };

    if (oldRef.id === newRef.id) {
      tx.update(oldRef, {
        professionalId: input.professionalId,
        serviceId: input.serviceId,
        startAt: input.startAt,
        endAt: input.endAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.set(newRef, payload);
      tx.update(oldRef, {
        status: "cancelled",
        cancellationReason: "remarcado",
        rescheduledTo: newId,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return newId;
}

export async function listAppointmentsByCustomer(
  tenantId: string,
  customerId: string,
  opts: { limit?: number } = {}
): Promise<Appointment[]> {
  const q = query(
    collectionFor(tenantId),
    where("customerId", "==", customerId),
    orderBy("startAt", "desc"),
    limit(opts.limit ?? 20)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Appointment);
}

export async function getAppointment(tenantId: string, id: string): Promise<Appointment | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Appointment) : null;
}
