import {
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Product, StockMovement, Supplier } from "@/types";
import { applyStockMovement, isMovementValid } from "@/lib/inventory";

const productsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).products();
const suppliersFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).suppliers();
const movementsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).stockMovements();

// ---------- PRODUTOS ----------

export async function listProducts(tenantId: string, onlyActive = false): Promise<Product[]> {
  const snap = await getDocs(query(productsFor(tenantId), orderBy("name")));
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);
  return onlyActive ? list.filter((p) => p.active) : list;
}

export interface CreateProductInput {
  name: string;
  description?: string;
  sku?: string;
  costPrice: number;
  salePrice: number;
  quantity: number;
  minQuantity: number;
  unit?: string;
  supplierId?: string;
  active?: boolean;
}

export async function createProduct(tenantId: string, input: CreateProductInput): Promise<string> {
  const ref = await addDoc(productsFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    description: input.description ?? null,
    sku: input.sku ?? null,
    costPrice: input.costPrice,
    salePrice: input.salePrice,
    quantity: input.quantity,
    minQuantity: input.minQuantity,
    unit: input.unit ?? null,
    supplierId: input.supplierId ?? null,
    active: input.active ?? true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  tenantId: string,
  id: string,
  input: Partial<CreateProductInput>
): Promise<void> {
  await updateDoc(doc(productsFor(tenantId), id), { ...input, updatedAt: serverTimestamp() });
}

export async function removeProduct(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(productsFor(tenantId), id));
}

// ---------- FORNECEDORES ----------

export async function listSuppliers(tenantId: string): Promise<Supplier[]> {
  const snap = await getDocs(query(suppliersFor(tenantId), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Supplier);
}

export interface CreateSupplierInput {
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
}

export async function createSupplier(tenantId: string, input: CreateSupplierInput): Promise<string> {
  const ref = await addDoc(suppliersFor(tenantId), {
    tenantId,
    name: input.name.trim(),
    contact: input.contact ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateSupplier(
  tenantId: string,
  id: string,
  input: Partial<CreateSupplierInput>
): Promise<void> {
  await updateDoc(doc(suppliersFor(tenantId), id), { ...input });
}

export async function removeSupplier(tenantId: string, id: string): Promise<void> {
  await deleteDoc(doc(suppliersFor(tenantId), id));
}

// ---------- MOVIMENTAÇÕES ----------

export async function listStockMovements(
  tenantId: string,
  productId?: string,
  opts: { max?: number } = {}
): Promise<StockMovement[]> {
  const constraints = [];
  if (productId) constraints.push(where("productId", "==", productId));
  const snap = await getDocs(
    query(movementsFor(tenantId), ...constraints, orderBy("createdAt", "desc"), limit(opts.max ?? 100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as StockMovement);
}

/**
 * Registra uma movimentação e atualiza o saldo do produto de forma
 * consistente (mesmo batch). Saídas não podem deixar saldo negativo.
 */
export async function recordStockMovement(
  tenantId: string,
  input: {
    productId: string;
    type: StockMovement["type"];
    quantity: number;
    reason?: string;
    sourceType?: StockMovement["sourceType"];
    sourceId?: string;
  }
): Promise<void> {
  if (!isMovementValid(input)) throw new Error("Movimentação inválida.");

  const db = getFirebaseFirestore();
  const productsSnap = await getDocs(query(productsFor(tenantId), where("__name__", "==", input.productId)));
  if (productsSnap.empty) throw new Error("Produto não encontrado.");
  const product = { id: productsSnap.docs[0].id, ...productsSnap.docs[0].data() } as Product;

  const result = applyStockMovement(product.quantity, { type: input.type, quantity: input.quantity });
  if (!result.ok) throw new Error(result.error);

  const batch = writeBatch(db);
  batch.update(doc(productsFor(tenantId), product.id), {
    quantity: result.quantity,
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(movementsFor(tenantId)), {
    tenantId,
    productId: product.id,
    productName: product.name,
    type: input.type,
    quantity: input.quantity,
    reason: input.reason ?? null,
    sourceType: input.sourceType ?? null,
    sourceId: input.sourceId ?? null,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}
