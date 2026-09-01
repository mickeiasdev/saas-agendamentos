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
import type { Branch } from "@/types";
import { applyMainBranch, toggleBranchActive, validateBranch } from "@/lib/branches";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).branches();

export async function listBranches(tenantId: string): Promise<Branch[]> {
  const snap = await getDocs(query(collectionFor(tenantId), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
}

export async function getBranch(tenantId: string, id: string): Promise<Branch | null> {
  const snap = await getDoc(doc(collectionFor(tenantId), id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Branch) : null;
}

export interface CreateBranchInput {
  name: string;
  address?: Branch["address"];
  phone?: string;
  whatsapp?: string;
  email?: string;
  isMain?: boolean;
}

/** Cria uma unidade; a primeira vira a principal. */
export async function createBranch(tenantId: string, input: CreateBranchInput): Promise<string> {
  const branches = await listBranches(tenantId);
  const validation = validateBranch(branches, { name: input.name });
  if (!validation.ok) throw new Error(validation.error);

  const isFirst = branches.length === 0;
  const ref = await addDoc(collectionFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    address: input.address ?? null,
    phone: input.phone ?? null,
    whatsapp: input.whatsapp ?? null,
    email: input.email ?? null,
    active: true,
    isMain: input.isMain ?? isFirst,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (input.isMain || isFirst) {
    await setMainBranch(tenantId, ref.id);
  }
  return ref.id;
}

export async function updateBranch(
  tenantId: string,
  id: string,
  input: Partial<CreateBranchInput>
): Promise<void> {
  const branches = await listBranches(tenantId);
  const current = branches.find((b) => b.id === id);
  if (!current) throw new Error("Unidade não encontrada.");

  if (input.name) {
    const validation = validateBranch(branches, { name: input.name, id });
    if (!validation.ok) throw new Error(validation.error);
  }

  await updateDoc(doc(collectionFor(tenantId), id), {
    ...input,
    name: input.name?.trim() ?? current.name,
    updatedAt: serverTimestamp(),
  });

  if (input.isMain) {
    await setMainBranch(tenantId, id);
  }
}

export async function removeBranch(tenantId: string, id: string): Promise<void> {
  const branches = await listBranches(tenantId);
  const target = branches.find((b) => b.id === id);
  if (!target) return;
  if (target.isMain) {
    throw new Error("A unidade principal não pode ser excluída.");
  }
  await deleteDoc(doc(collectionFor(tenantId), id));
}

/** Garante que apenas uma unidade é a principal. */
export async function setMainBranch(tenantId: string, id: string): Promise<void> {
  const branches = await listBranches(tenantId);
  const updated = applyMainBranch(branches, id, true);
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  for (const b of updated) {
    if (b.isMain !== branches.find((x) => x.id === b.id)?.isMain) {
      batch.update(doc(collectionFor(tenantId), b.id), {
        isMain: b.isMain,
        updatedAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

export async function toggleBranch(tenantId: string, id: string, active: boolean): Promise<void> {
  const branches = await listBranches(tenantId);
  const result = toggleBranchActive(branches, id, active);
  if (result.error) throw new Error(result.error);
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  for (const b of result.branches) {
    const prev = branches.find((x) => x.id === b.id)!;
    if (b.active !== prev.active || b.isMain !== prev.isMain) {
      batch.update(doc(collectionFor(tenantId), b.id), {
        active: b.active,
        isMain: b.isMain,
        updatedAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}
