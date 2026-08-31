import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Customer } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).customers();

export interface CustomerPage {
  items: Customer[];
  nextCursor: QueryDocumentSnapshot | null;
}

function matchesSearch(c: Customer, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true;
  return (
    c.name.toLowerCase().includes(t) ||
    (c.email ?? "").toLowerCase().includes(t) ||
    (c.phone ?? "").replace(/\D/g, "").includes(t.replace(/\D/g, "")) ||
    (c.whatsapp ?? "").replace(/\D/g, "").includes(t.replace(/\D/g, ""))
  );
}

export async function listCustomers(
  tenantId: string,
  opts: { search?: string; pageSize?: number; cursor?: QueryDocumentSnapshot | null } = {}
): Promise<CustomerPage> {
  const size = opts.pageSize ?? 20;
  const search = opts.search?.trim();

  if (search) {
    const snap = await getDocs(query(collectionFor(tenantId), orderBy("name"), limit(500)));
    const items = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Customer)
      .filter((c) => matchesSearch(c, search))
      .slice(0, size);
    return { items, nextCursor: null };
  }

  const base = query(collectionFor(tenantId), orderBy("name"), limit(size));
  const q = opts.cursor ? query(base, startAfter(opts.cursor)) : base;
  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Customer);
  return { items, nextCursor: snap.docs.length === size ? snap.docs[snap.docs.length - 1] : null };
}

export async function getCustomer(tenantId: string, id: string): Promise<Customer | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Customer) : null;
}

export interface CreateCustomerInput {
  name: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  birthDate?: string;
  notes?: string;
  tags?: string[];
}

export async function upsertCustomer(
  tenantId: string,
  id: string | undefined,
  input: CreateCustomerInput
): Promise<string> {
  const base = {
    ...input,
    tags: input.tags ?? [],
    totalSpent: 0,
    visitCount: 0,
  };
  if (id) {
    const ref = doc(collectionFor(tenantId), id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...base, updatedAt: serverTimestamp() });
      return id;
    }
  }
  const docRef = await addDoc(collectionFor(tenantId), {
    ...base,
    tenantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteCustomer(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
