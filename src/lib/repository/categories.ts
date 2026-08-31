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
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Category } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).categories();

export async function listCategories(tenantId: string, onlyActive = false): Promise<Category[]> {
  const q = query(
    collectionFor(tenantId),
    orderBy("order"),
    ...(onlyActive ? [where("status", "==", "active")] : [])
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Category);
}

export async function getCategory(tenantId: string, id: string): Promise<Category | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Category) : null;
}

export async function createCategory(
  tenantId: string,
  input: Pick<Category, "name" | "description" | "status">
): Promise<Category> {
  const existing = await listCategories(tenantId);
  const order = existing.length;
  const docRef = await addDoc(collectionFor(tenantId), {
    ...input,
    tenantId,
    order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return { id: docRef.id, ...input, tenantId, order, createdAt: null as never, updatedAt: null as never };
}

export async function updateCategory(
  tenantId: string,
  id: string,
  input: Partial<Pick<Category, "name" | "description" | "status" | "order">>
): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function removeCategory(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
