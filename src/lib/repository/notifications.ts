import {
  addDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Notification } from "@/types";

const collectionFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).notifications();

export interface CreateNotificationInput {
  userId?: string;
  type: Notification["type"];
  title: string;
  body: string;
}

export async function listNotifications(
  tenantId: string,
  opts: { unreadOnly?: boolean; max?: number } = {}
): Promise<Notification[]> {
  const q = query(
    collectionFor(tenantId),
    ...(opts.unreadOnly ? [where("read", "==", false)] : []),
    orderBy("createdAt", "desc"),
    limit(opts.max ?? 50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Notification);
}

/** Listener realtime usado pelo sino de notificações (1 único listener por tenant). */
export function subscribeUnread(
  tenantId: string,
  cb: (count: number) => void
): Unsubscribe {
  const q = query(
    collectionFor(tenantId),
    where("read", "==", false),
    orderBy("createdAt", "desc"),
    limit(30)
  );
  return onSnapshot(q, (snap) => cb(snap.size));
}

export async function markNotificationRead(tenantId: string, id: string): Promise<void> {
  await updateDoc(doc(collectionFor(tenantId), id), { read: true });
}

export async function markAllNotificationsRead(tenantId: string): Promise<void> {
  const snap = await getDocs(query(collectionFor(tenantId), where("read", "==", false)));
  if (snap.empty) return;
  const db = getFirebaseFirestore();
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.update(d.ref, { read: true }));
  await batch.commit();
}

export async function createNotification(
  tenantId: string,
  input: CreateNotificationInput
): Promise<void> {
  await addDoc(collectionFor(tenantId), {
    tenantId,
    userId: input.userId ?? null,
    type: input.type,
    title: input.title,
    body: input.body,
    read: false,
    createdAt: serverTimestamp(),
  });
}
