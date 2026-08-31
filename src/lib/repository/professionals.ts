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
import type { Professional } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).professionals();

/**
 * Mantém a lista de profissionais de cada serviço (professionals)
 * consistente com os serviços vinculados ao profissional (serviceIds).
 */
export async function syncProfessionalServices(
  tenantId: string,
  professionalId: string,
  serviceIds: string[]
): Promise<void> {
  const db = getFirebaseFirestore();
  const svcSnap = await getDocs(tenantCollections(db, tenantId).services());
  const batch = writeBatch(db);
  for (const d of svcSnap.docs) {
    const current: string[] = d.data().professionals ?? [];
    const has = current.includes(professionalId);
    const should = serviceIds.includes(d.id);
    if (has !== should) {
      batch.update(d.ref, {
        professionals: should ? [...current, professionalId] : current.filter((id) => id !== professionalId),
        updatedAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

export async function listProfessionals(tenantId: string, onlyActive = false): Promise<Professional[]> {
  const q = query(collectionFor(tenantId), orderBy("name"));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Professional);
  return onlyActive ? list.filter((p) => p.active) : list;
}

export async function getProfessional(tenantId: string, id: string): Promise<Professional | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Professional) : null;
}

export interface CreateProfessionalInput {
  name: string;
  photoUrl?: string;
  description?: string;
  phone?: string;
  email?: string;
  color: string;
  active: boolean;
  serviceIds: string[];
}

export async function createProfessional(
  tenantId: string,
  input: CreateProfessionalInput
): Promise<string> {
  const docRef = await addDoc(collectionFor(tenantId), {
    ...input,
    tenantId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (input.serviceIds.length) {
    await syncProfessionalServices(tenantId, docRef.id, input.serviceIds);
  }
  return docRef.id;
}

export async function updateProfessional(
  tenantId: string,
  id: string,
  input: Partial<CreateProfessionalInput>
): Promise<void> {
  const { serviceIds, ...rest } = input;
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...rest,
    updatedAt: serverTimestamp(),
  });
  if (serviceIds) {
    await syncProfessionalServices(tenantId, id, serviceIds);
  }
}

export async function removeProfessional(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
