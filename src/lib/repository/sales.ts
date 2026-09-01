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
  writeBatch,
} from "firebase/firestore";
import { getFirebaseFirestore } from "@/lib/firebase/client";
import { tenantCollections } from "./collections";
import type { Sale, SaleItem } from "@/types";
import {
  computeSaleTotals,
  saleDeductions,
  saleToFinancialEntry,
  validateSaleItems,
  validateSaleStock,
} from "@/lib/sales";
import { applyStockMovement } from "@/lib/inventory";
import type { Product } from "@/types";

const salesFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).sales();
const productsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).products();
const movementsFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).stockMovements();
const financialFor = (tenantId: string) => tenantCollections(getFirebaseFirestore(), tenantId).financial();

export async function listSales(tenantId: string, opts: { max?: number } = {}): Promise<Sale[]> {
  const snap = await getDocs(
    query(salesFor(tenantId), orderBy("createdAt", "desc"), limit(opts.max ?? 100))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Sale);
}

export interface CreateSaleInput {
  items: SaleItem[];
  discount?: number;
  customerId?: string;
  customerName?: string;
  paymentMethod: Sale["paymentMethod"];
}

/**
 * Cria uma venda validando estoque e lançando, no mesmo batch:
 *  - o documento da venda;
 *  - a baixa de estoque de cada produto;
 *  - as movimentações de saída;
 *  - a entrada financeira (Fase 3.11).
 */
export async function createSale(tenantId: string, input: CreateSaleInput): Promise<string> {
  const itemValidation = validateSaleItems(input.items);
  if (!itemValidation.ok) throw new Error(itemValidation.error);

  const db = getFirebaseFirestore();
  const productsSnap = await getDocs(productsFor(tenantId));
  const products = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Product);

  const stockCheck = validateSaleStock(products, input.items);
  if (!stockCheck.ok) throw new Error(stockCheck.error);

  const totals = computeSaleTotals(input.items, input.discount ?? 0);

  const saleRef = doc(salesFor(tenantId));
  const batch = writeBatch(db);

  batch.set(saleRef, {
    tenantId,
    items: input.items,
    total: totals.total,
    discount: totals.discount,
    customerId: input.customerId ?? null,
    customerName: input.customerName ?? null,
    paymentMethod: input.paymentMethod,
    status: "completed",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const deduction of saleDeductions(input.items)) {
    const product = products.find((p) => p.id === deduction.productId)!;
    const result = applyStockMovement(product.quantity, {
      type: "out",
      quantity: deduction.quantity,
    });
    if (!result.ok) throw new Error(result.error);

    batch.update(doc(productsFor(tenantId), product.id), {
      quantity: result.quantity,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(movementsFor(tenantId)), {
      tenantId,
      productId: product.id,
      productName: product.name,
      type: "out",
      quantity: deduction.quantity,
      reason: `Venda ${saleRef.id}`,
      sourceType: "sale",
      sourceId: saleRef.id,
      createdAt: serverTimestamp(),
    });
  }

  const sale = {
    id: saleRef.id,
    tenantId,
    items: input.items,
    total: totals.total,
    discount: totals.discount,
    customerId: input.customerId,
    customerName: input.customerName,
    paymentMethod: input.paymentMethod,
    status: "completed" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const entry = saleToFinancialEntry(sale);
  batch.set(doc(financialFor(tenantId)), {
    tenantId,
    type: entry.type,
    category: entry.category,
    description: entry.description,
    amount: entry.amount,
    date: entry.date,
    sourceId: entry.sourceId,
    sourceType: entry.sourceType,
    createdAt: serverTimestamp(),
  });

  await batch.commit();
  return saleRef.id;
}

export async function cancelSale(tenantId: string, saleId: string): Promise<void> {
  await updateDoc(doc(salesFor(tenantId), saleId), {
    status: "cancelled",
    updatedAt: serverTimestamp(),
  });
}

export async function getSale(tenantId: string, saleId: string): Promise<Sale | null> {
  const snap = await getDocs(query(salesFor(tenantId), where("__name__", "==", saleId)));
  return snap.empty ? null : ({ id: snap.docs[0].id, ...snap.docs[0].data() } as Sale);
}
