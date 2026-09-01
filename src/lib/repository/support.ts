import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { SupportMessage, SupportTicket, SupportTicketPriority, SupportTicketStatus } from "@/types";
import { canTransitionTicketStatus, isTicketBodyValid, isTicketTitleValid } from "@/lib/support";

const ticketsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).supportTickets();
const messagesFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).supportMessages();

export interface CreateTicketInput {
  subject: string;
  category?: string;
  priority: SupportTicketPriority;
  createdBy: string;
  createdByName?: string;
  body: string;
}

/** Abre um ticket e registra a primeira mensagem. */
export async function createTicket(tenantId: string, input: CreateTicketInput): Promise<string> {
  if (!isTicketTitleValid(input.subject)) throw new Error("Assunto deve ter ao menos 3 caracteres.");
  if (!isTicketBodyValid(input.body)) throw new Error("Mensagem deve ter ao menos 3 caracteres.");

  const db = getFirebaseFirestore();
  const ref = doc(ticketsFor(tenantId));
  const batch = writeBatch(db);
  batch.set(ref, {
    tenantId,
    subject: input.subject.trim(),
    category: input.category ?? null,
    priority: input.priority,
    status: "open",
    createdBy: input.createdBy,
    createdByName: input.createdByName ?? null,
    assignedTo: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(messagesFor(tenantId)), {
    tenantId,
    ticketId: ref.id,
    authorId: input.createdBy,
    authorName: input.createdByName ?? "Cliente",
    body: input.body.trim(),
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return ref.id;
}

export async function listTickets(
  tenantId: string,
  opts: { status?: SupportTicketStatus; max?: number } = {}
): Promise<SupportTicket[]> {
  const constraints = [];
  if (opts.status) constraints.push(where("status", "==", opts.status));
  const snap = await getDocs(
    query(ticketsFor(tenantId), ...constraints, orderBy("createdAt", "desc"), limit(opts.max ?? 100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportTicket);
}

export async function getTicket(tenantId: string, ticketId: string): Promise<SupportTicket | null> {
  const snap = await getDocs(query(ticketsFor(tenantId), where("__name__", "==", ticketId)));
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as SupportTicket);
}

export async function changeTicketStatus(
  tenantId: string,
  ticketId: string,
  to: SupportTicketStatus,
  actorId: string
): Promise<{ ok: boolean; error?: string }> {
  const ticket = await getTicket(tenantId, ticketId);
  if (!ticket) return { ok: false, error: "Ticket não encontrado." };
  if (!canTransitionTicketStatus(ticket.status, to)) {
    return { ok: false, error: `Transição de ${ticket.status} para ${to} não permitida.` };
  }
  await updateDoc(doc(ticketsFor(tenantId), ticketId), {
    status: to,
    updatedAt: serverTimestamp(),
  });
  return { ok: true };
}

export async function assignTicket(tenantId: string, ticketId: string, userId: string): Promise<void> {
  await updateDoc(doc(ticketsFor(tenantId), ticketId), {
    assignedTo: userId,
    updatedAt: serverTimestamp(),
  });
}

export async function addTicketMessage(
  tenantId: string,
  input: { ticketId: string; authorId: string; authorName: string; body: string }
): Promise<void> {
  if (!isTicketBodyValid(input.body)) throw new Error("Mensagem deve ter ao menos 3 caracteres.");
  await addDoc(messagesFor(tenantId), {
    tenantId,
    ticketId: input.ticketId,
    authorId: input.authorId,
    authorName: input.authorName,
    body: input.body.trim(),
    createdAt: serverTimestamp(),
  });
}

export async function listTicketMessages(tenantId: string, ticketId: string): Promise<SupportMessage[]> {
  const snap = await getDocs(
    query(messagesFor(tenantId), where("ticketId", "==", ticketId), orderBy("createdAt", "asc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as SupportMessage);
}
