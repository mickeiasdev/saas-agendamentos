import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Holiday } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).holidays();

export async function listHolidays(tenantId: string): Promise<Holiday[]> {
  const snap = await getDocs(query(collectionFor(tenantId), orderBy("date", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Holiday);
}

export interface CreateHolidayInput {
  date: string; // YYYY-MM-DD
  name: string;
}

export async function createHoliday(tenantId: string, input: CreateHolidayInput): Promise<string> {
  const docRef = await addDoc(collectionFor(tenantId), {
    tenantId,
    date: input.date,
    name: input.name.trim(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateHoliday(
  tenantId: string,
  id: string,
  patch: Partial<CreateHolidayInput>
): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...patch,
    ...(patch.name != null ? { name: patch.name.trim() } : {}),
  });
}

export async function deleteHoliday(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
