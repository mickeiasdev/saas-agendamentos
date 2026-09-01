import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { CustomerPackage, ServicePackage } from "@/types";
import {
  buildCustomerPackageItems,
  isPackageExpired,
  isPackageValid,
  isPackageFullyUsed,
} from "@/lib/packages";

const packagesFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).packages();
const customerPackagesFor = (tenantId: string) =>
  tenantCollections(getFirebaseFirestore(), tenantId).customerPackages();

// ---------- PACOTES (catalogo) ----------

export async function listPackages(tenantId: string, onlyActive = false): Promise<ServicePackage[]> {
  const snap = await getDocs(query(packagesFor(tenantId), orderBy("name")));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as ServicePackage);
  return onlyActive ? list.filter((p) => p.active) : list;
}

export async function getPackage(tenantId: string, id: string): Promise<ServicePackage | null> {
  const snap = await getDocs(query(packagesFor(tenantId), where("__name__", "==", id)));
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as ServicePackage);
}

export interface CreatePackageInput {
  name: string;
  description?: string;
  items: { serviceId: string; serviceName: string; quantity: number }[];
  price: number;
  validDays?: number;
  active?: boolean;
}

export async function createPackage(tenantId: string, input: CreatePackageInput): Promise<string> {
  const validation = isPackageValid({ items: input.items, price: input.price });
  if (!validation) throw new Error("Dados do pacote inválidos.");
  const ref = await addDoc(packagesFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    description: input.description ?? null,
    items: input.items,
    price: input.price,
    validDays: input.validDays ?? null,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePackage(
  tenantId: string,
  id: string,
  input: Partial<CreatePackageInput>
): Promise<void> {
  await updateDoc(doc(packagesFor(tenantId), id), {
    ...input,
    updatedAt: serverTimestamp(),
  });
}

export async function removePackage(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(packagesFor(tenantId), id));
}

// ---------- PACOTES DO CLIENTE ----------

export async function listCustomerPackages(
  tenantId: string,
  customerId?: string
): Promise<CustomerPackage[]> {
  const q = customerId
    ? query(customerPackagesFor(tenantId), where("customerId", "==", customerId))
    : query(customerPackagesFor(tenantId), orderBy("purchasedAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CustomerPackage);
}

/** Vende um pacote a um cliente (cria o pacote do cliente com validade). */
export async function purchasePackageForCustomer(
  tenantId: string,
  pkg: ServicePackage,
  input: { customerId: string; customerName: string; purchasedAt?: Date }
): Promise<string> {
  const ref = await addDoc(customerPackagesFor(tenantId), {
    tenantId,
    packageId: pkg.id,
    packageName: pkg.name,
    customerId: input.customerId,
    customerName: input.customerName,
    items: buildCustomerPackageItems(pkg),
    price: pkg.price,
    purchasedAt: input.purchasedAt ?? new Date(),
    expiresAt: pkg.validDays
      ? new Date(Date.now() + pkg.validDays * 86400000)
      : null,
    status: "active",
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Consome uma sessão e atualiza o status derivado. */
export async function consumeCustomerPackage(
  tenantId: string,
  customerPackageId: string,
  serviceId: string,
  now = new Date()
): Promise<void> {
  const snapshot = await getDocs(
    query(customerPackagesFor(tenantId), where("__name__", "==", customerPackageId))
  );
  if (snapshot.empty) throw new Error("Pacote do cliente não encontrado.");
  const cp = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CustomerPackage;
  const item = cp.items.find((i) => i.serviceId === serviceId);
  if (!item) throw new Error("Este serviço não faz parte do pacote.");
  if (cp.status !== "active") throw new Error("Pacote não está ativo.");
  if (isPackageExpired(cp, now)) throw new Error("Pacote vencido.");
  if (item.used >= item.total) throw new Error("Sessões esgotadas para este serviço.");

  const items = cp.items.map((i) =>
    i.serviceId === serviceId ? { ...i, used: i.used + 1 } : i
  );
  const derived = isPackageExpired(cp, now)
    ? "expired"
    : isPackageFullyUsed({ items })
      ? "used"
      : "active";

  await updateDoc(doc(customerPackagesFor(tenantId), customerPackageId), {
    items,
    status: derived,
  });
}
