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
import type { Coupon } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).coupons();

export async function listCoupons(tenantId: string): Promise<Coupon[]> {
  const snap = await getDocs(query(collectionFor(tenantId), orderBy("code")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Coupon);
}

export interface CreateCouponInput {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minValue?: number;
  validFrom?: string;
  validUntil?: string;
  usageLimit?: number;
  active: boolean;
}

export async function createCoupon(tenantId: string, input: CreateCouponInput): Promise<string> {
  const docRef = await addDoc(collectionFor(tenantId), {
    ...input,
    code: input.code.trim().toUpperCase(),
    usedCount: 0,
    tenantId,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCoupon(
  tenantId: string,
  id: string,
  patch: Partial<CreateCouponInput>
): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), id), {
    ...patch,
    ...(patch.code ? { code: patch.code.trim().toUpperCase() } : {}),
  });
}

export async function deleteCoupon(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
