import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { DayOfWeek, Promotion, PromotionType } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).promotions();

export interface UpsertPromotionInput {
  name: string;
  type: PromotionType;
  discountType: "percent" | "fixed";
  discountValue: number;
  active: boolean;
  serviceId?: string;
  comboServiceIds?: string[];
  offPeakDays?: DayOfWeek[];
  offPeakStartTime?: string;
  offPeakEndTime?: string;
  validFrom?: string;
  validUntil?: string;
}

export async function listPromotions(tenantId: string): Promise<Promotion[]> {
  const snap = await getDocs(query(collectionFor(tenantId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Promotion);
}

export async function upsertPromotion(
  tenantId: string,
  id: string | undefined,
  input: UpsertPromotionInput
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
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deletePromotion(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
