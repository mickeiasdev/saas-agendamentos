import {
  addDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { LgpdConsent } from "@/types";
import { buildConsentRecord, hasConsent } from "@/lib/lgpd";

const consentsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).lgpdConsents();

export async function listConsents(
  tenantId: string,
  subjectId?: string
): Promise<LgpdConsent[]> {
  const constraints = [];
  if (subjectId) constraints.push(where("subjectId", "==", subjectId));
  const snap = await getDocs(
    query(consentsFor(tenantId), ...constraints, orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LgpdConsent);
}

export async function upsertConsent(
  tenantId: string,
  input: {
    subject: LgpdConsent["subject"];
    subjectId: string;
    consentType: LgpdConsent["consentType"];
    granted: boolean;
  },
  now = new Date()
): Promise<string> {
  const snap = await getDocs(
    query(
      consentsFor(tenantId),
      where("subject", "==", input.subject),
      where("subjectId", "==", input.subjectId),
      where("consentType", "==", input.consentType),
      limit(1)
    )
  );
  const record = buildConsentRecord(
    { tenantId, ...input },
    now
  );

  if (!snap.empty) {
    const id = snap.docs[0].id;
    await updateDoc(doc(consentsFor(tenantId), id), record);
    return id;
  }
  const ref = await addDoc(consentsFor(tenantId), record);
  return ref.id;
}

export async function subjectHasConsent(
  tenantId: string,
  subjectId: string,
  consentType: LgpdConsent["consentType"]
): Promise<boolean> {
  const consents = await listConsents(tenantId, subjectId);
  return hasConsent(consents, consentType);
}
