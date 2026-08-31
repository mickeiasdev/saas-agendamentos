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
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Appointment } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).appointments();

export async function listAppointments(
  tenantId: string,
  opts: { from: Date; to: Date; professionalId?: string; status?: string } = { from: new Date(0), to: new Date(8640000000000000) }
): Promise<Appointment[]> {
  let q = query(
    collectionFor(tenantId),
    where("startAt", ">=", opts.from),
    where("startAt", "<=", opts.to),
    orderBy("startAt"),
    limit(500)
  );
  if (opts.professionalId) {
    q = query(q, where("professionalId", "==", opts.professionalId));
  }
  const snap = await getDocs(q);
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

/**
 * Cria um agendamento com PREVENÇÃO DE DOUBLE BOOKING.
 *
 * Estratégia: o ID do documento é determinístico a partir do profissional e do
 * início do horário (`{profissional}_{timestamp}`). Dentro de uma transação
 * Firestore, verificamos se o documento já existe antes de gravar. Dois clientes
 * tentando reservar o MESMO horário geram o MESMO ID: quando a transação do
 * segundo cliente é executada após a do primeiro, a leitura encontra o documento
 * existente e o agendamento é recusado.
 *
 * Uma checagem adicional por sobreposição (query) roda antes da transação para
 * impedir horários conflitantes criados manualmente fora do grid de slots.
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<string> {
  const db = getFirebaseFirestore();
  const appointmentsCol = tenantCollections(db, input.tenantId).appointments();

  const overlapQuery = query(
    appointmentsCol,
    where("professionalId", "==", input.professionalId),
    where("startAt", "<", input.endAt),
    where("endAt", ">", input.startAt)
  );
  const overlapSnap = await getDocs(overlapQuery);
  const overlaps = overlapSnap.docs
    .map((d) => d.data() as Appointment)
    .filter((a) => a.status !== "cancelled" && a.status !== "no_show");
  if (overlaps.length > 0) {
    throw new Error("Horário indisponível: já existe um agendamento neste intervalo.");
  }

  const slotId = `${input.professionalId}_${input.startAt.getTime()}`;
  const ref = doc(appointmentsCol, slotId);

  await runTransaction(db, async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists()) {
      throw new Error("Horário indisponível: este horário acabou de ser reservado.");
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
