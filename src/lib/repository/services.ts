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
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Service } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).services();

/**
 * Mantém a lista de profissionais (serviceIds) consistente com os
 * profissionais vinculados a um serviço (professionals).
 */
export async function syncServiceProfessionals(
  tenantId: string,
  serviceId: string,
  professionalIds: string[]
): Promise<void> {
  const db = getFirebaseFirestore();
  const prosSnap = await getDocs(tenantCollections(db, tenantId).professionals());
  const batch = writeBatch(db);
  for (const d of prosSnap.docs) {
    const current: string[] = d.data().serviceIds ?? [];
    const has = current.includes(serviceId);
    const should = professionalIds.includes(d.id);
    if (has !== should) {
      batch.update(d.ref, {
        serviceIds: should ? [...current, serviceId] : current.filter((id) => id !== serviceId),
        updatedAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

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
  if (input.professionals?.length) {
    await syncServiceProfessionals(tenantId, docRef.id, input.professionals);
  }
  return docRef.id;
}

export async function updateService(
  tenantId: string,
  id: string,
  input: Partial<CreateServiceInput>
): Promise<void> {
  const { professionals, ...rest } = input;
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
  if (professionals) {
    await syncServiceProfessionals(tenantId, id, professionals);
  }
}

export async function removeService(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
