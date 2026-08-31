import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Service } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).services();

export async function listServices(tenantId: string, onlyActive = false): Promise<Service[]> {
  const q = query(collectionFor(tenantId), orderBy("name"));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Service);
  return onlyActive ? list.filter((s) => s.status === "active") : list;
}

export async function getService(tenantId: string, id: string): Promise<Service | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Service) : null;
}

export interface CreateServiceInput {
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  categoryId?: string;
  imageUrl?: string;
  status: "active" | "inactive";
  commissionPercent?: number;
  requiresProfessional: boolean;
  professionals?: string[];
}

export async function createService(
  tenantId: string,
  input: CreateServiceInput
): Promise<string> {
  const docRef = await addDoc(collectionFor(tenantId), {
    ...input,
    tenantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateService(
  tenantId: string,
  id: string,
  input: Partial<CreateServiceInput>
): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function removeService(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
