import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import { pointsForAmount } from "@/lib/loyalty";
import type { LoyaltyAccount, LoyaltyReward, LoyaltyTransaction } from "@/types";

const rewards = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).loyaltyRewards();
const accounts = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).loyaltyAccounts();
const transactions = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).loyaltyTransactions();

// ---------- RECOMPENSAS ----------

export interface UpsertRewardInput {
  name: string;
  description?: string;
  pointsCost: number;
  active: boolean;
}

export async function listLoyaltyRewards(tenantId: string): Promise<LoyaltyReward[]> {
  const snap = await getDocs(query(rewards(tenantId), orderBy("pointsCost", "asc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoyaltyReward);
}

export async function upsertLoyaltyReward(
  tenantId: string,
  id: string | undefined,
  input: UpsertRewardInput
): Promise<string> {
  if (id) {
    const ref = doc(rewards(tenantId), id);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, { ...input, updatedAt: serverTimestamp() });
      return id;
    }
  }
  const ref = await addDoc(rewards(tenantId), {
    ...input,
    tenantId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteLoyaltyReward(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(rewards(tenantId), id));
}

// ---------- CONTAS E PONTOS ----------

async function getAccountByCustomer(
  tenantId: string,
  customerId: string
): Promise<LoyaltyAccount | null> {
  const snap = await getDocs(
    query(accounts(tenantId), where("customerId", "==", customerId), limit(1))
  );
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as LoyaltyAccount);
}

async function ensureAccount(
  tenantId: string,
  customerId: string,
  customerName: string
): Promise<string> {
  const existing = await getAccountByCustomer(tenantId, customerId);
  if (existing) return existing.id;
  const ref = await addDoc(accounts(tenantId), {
    tenantId,
    customerId,
    customerName,
    points: 0,
    pointsEarned: 0,
    pointsSpent: 0,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function listLoyaltyAccounts(tenantId: string): Promise<LoyaltyAccount[]> {
  const snap = await getDocs(query(accounts(tenantId), orderBy("points", "desc"), limit(100)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoyaltyAccount);
}

export async function earnLoyaltyPoints(
  tenantId: string,
  customerId: string,
  customerName: string,
  amount: number,
  description: string
): Promise<{ ok: boolean; pointsEarned: number }> {
  const pointsEarned = pointsForAmount(amount);
  if (pointsEarned <= 0) return { ok: true, pointsEarned: 0 };

  const db = getFirebaseFirestore();
  const accountId = await ensureAccount(tenantId, customerId, customerName);
  const accountRef = doc(accounts(tenantId), accountId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(accountRef);
    const current = snap.exists() ? (snap.data().points as number) : 0;
    tx.update(accountRef, {
      points: current + pointsEarned,
      pointsEarned: (snap.exists() ? (snap.data().pointsEarned as number) : 0) + pointsEarned,
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(transactions(tenantId)), {
      tenantId,
      customerId,
      type: "earn",
      points: pointsEarned,
      description,
      createdAt: serverTimestamp(),
    });
  });

  return { ok: true, pointsEarned };
}

export async function redeemLoyaltyPoints(
  tenantId: string,
  customerId: string,
  reward: LoyaltyReward
): Promise<{ ok: boolean; error?: string }> {
  const db = getFirebaseFirestore();
  const existing = await getAccountByCustomer(tenantId, customerId);
  if (!existing) return { ok: false, error: "Cliente ainda não possui saldo de pontos." };
  const accountRef = doc(accounts(tenantId), existing.id);

  let ok = false;
  let error: string | undefined;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(accountRef);
    if (!snap.exists) {
      error = "Conta de fidelidade não encontrada.";
      return;
    }
    const balance = (snap.data() as { points?: number }).points ?? 0;
    if (balance < reward.pointsCost) {
      error = `Saldo insuficiente (${balance}/${reward.pointsCost}).`;
      return;
    }
    tx.update(accountRef, {
      points: balance - reward.pointsCost,
      pointsSpent: ((snap.data() as { pointsSpent?: number }).pointsSpent ?? 0) + reward.pointsCost,
      updatedAt: serverTimestamp(),
    });
    tx.set(doc(transactions(tenantId)), {
      tenantId,
      customerId,
      type: "redeem",
      points: reward.pointsCost,
      description: `Resgate: ${reward.name}`,
      rewardId: reward.id,
      createdAt: serverTimestamp(),
    });
    ok = true;
  });

  return { ok, error };
}

export async function listLoyaltyTransactions(
  tenantId: string,
  opts: { max?: number } = {}
): Promise<LoyaltyTransaction[]> {
  const snap = await getDocs(
    query(transactions(tenantId), orderBy("createdAt", "desc"), limit(opts.max ?? 50))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as LoyaltyTransaction);
}
