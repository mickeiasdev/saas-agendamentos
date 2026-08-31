import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Review } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).reviews();

export async function listReviews(tenantId: string): Promise<Review[]> {
  const snap = await getDocs(query(collectionFor(tenantId), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Review);
}

export interface CreateReviewInput {
  appointmentId?: string;
  customerId?: string;
  rating: number;
  comment?: string;
}

export async function createReview(tenantId: string, input: CreateReviewInput): Promise<string> {
  const docRef = await addDoc(collectionFor(tenantId), {
    tenantId,
    appointmentId: input.appointmentId ?? null,
    customerId: input.customerId ?? null,
    rating: input.rating,
    comment: input.comment ?? null,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function deleteReview(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionFor(tenantId), id));
}
