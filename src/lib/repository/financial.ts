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
  updateDoc,
  where,
  type QueryConstraint,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { FinancialCategory, FinancialEntry, FinancialEntryType } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).financial();

export interface CreateFinancialEntryInput {
  type: FinancialEntryType;
  category: FinancialCategory;
  description: string;
  amount: number;
  date: string; // YYYY-MM-DD
  sourceId?: string;
  sourceType?: FinancialEntry["sourceType"];
}

export async function listFinancialEntries(
  tenantId: string,
  opts: {
    from?: string;
    to?: string;
    type?: FinancialEntryType;
    max?: number;
  } = {}
): Promise<FinancialEntry[]> {
  const constraints: QueryConstraint[] = [];
  if (opts.from) constraints.push(where("date", ">=", opts.from));
  if (opts.to) constraints.push(where("date", "<=", opts.to));
  if (opts.type) constraints.push(where("type", "==", opts.type));

  const snap = await getDocs(
    query(collectionFor(tenantId), ...constraints, orderBy("date", "desc"), limit(opts.max ?? 200))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FinancialEntry);
}

export async function upsertFinancialEntry(
  tenantId: string,
  id: string | undefined,
  input: CreateFinancialEntryInput
): Promise<string> {
  if (id) {
    const ref = doc(collectionFor(tenantId), id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...input, updatedAt: serverTimestamp() });
      return id;
    }
  }
  const ref = await addDoc(collectionFor(tenantId), {
    ...input,
    tenantId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteFinancialEntry(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
