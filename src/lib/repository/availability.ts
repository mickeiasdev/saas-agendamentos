import {
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { ProfessionalAvailability, WorkDay } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).availability();

const DEFAULT_WORK_DAYS: WorkDay[] = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
  dayOfWeek: d as never,
  enabled: d >= 1 && d <= 5,
  startTime: "09:00",
  endTime: "18:00",
  breaks: [],
}));

export async function getAvailability(
  tenantId: string,
  professionalId: string
): Promise<ProfessionalAvailability | null> {
  const q = query(
    collectionFor(tenantId),
    where("professionalId", "==", professionalId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() } as ProfessionalAvailability;
}

export async function ensureAvailability(
  tenantId: string,
  professionalId: string
): Promise<ProfessionalAvailability> {
  const existing = await getAvailability(tenantId, professionalId);
  if (existing) return existing;

  const docRef = await addDoc(collectionFor(tenantId), {
    tenantId,
    professionalId,
    workDays: DEFAULT_WORK_DAYS,
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: serverTimestamp(),
  });
  return {
    id: docRef.id,
    tenantId,
    professionalId,
    workDays: DEFAULT_WORK_DAYS,
    daysOff: [],
    vacations: [],
    blockedDates: [],
    exceptions: [],
    updatedAt: null as never,
  };
}

export async function updateAvailability(
  tenantId: string,
  availabilityId: string,
  patch: Partial<Omit<ProfessionalAvailability, "id" | "tenantId" | "professionalId">>
): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), availabilityId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function saveAvailability(
  tenantId: string,
  professionalId: string,
  input: Omit<ProfessionalAvailability, "id" | "tenantId" | "professionalId" | "updatedAt">
): Promise<void> {
  const existing = await getAvailability(tenantId, professionalId);
  if (existing) {
    await updateDoc(doc(collectionFor(tenantId), existing.id), {
      ...input,
      updatedAt: serverTimestamp(),
    });
  } else {
    const docRef = doc(collectionFor(tenantId));
    await setDoc(docRef, {
      id: docRef.id,
      tenantId,
      professionalId,
      ...input,
      updatedAt: serverTimestamp(),
    });
  }
}
