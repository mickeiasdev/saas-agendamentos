import { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminSdkMissingResponse, getAdminFirestore } from "@/lib/server/firebaseAdmin";

export const dynamic = "force-dynamic";

interface ReviewBody {
  tenantSlug?: string;
  appointmentId?: string;
  rating?: number;
  comment?: string;
  name?: string;
  phone?: string;
}

/**
 * Submissão pública de avaliação após o atendimento (Fase 2.16).
 *
 * O cliente do site público NÃO escreve diretamente no Firestore (isso evita
 * qualquer risco de isolamento multi-tenant). Esta rota usa o Admin SDK para
 * validar que o agendamento existe, pertence ao tenant informado e já foi
 * concluído, impedindo também avaliações duplicadas por atendimento.
 */
export async function POST(req: NextRequest) {
  const db = getAdminFirestore();

  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return Response.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const slug = body.tenantSlug?.trim().toLowerCase();
  const appointmentId = body.appointmentId?.trim();
  const rating = body.rating;
  const comment = body.comment?.trim();
  const name = body.name?.trim();
  const phone = body.phone?.trim();

  if (!slug || !appointmentId) {
    return Response.json({ error: "Dados incompletos para a avaliação." }, { status: 400 });
  }
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) {
    return Response.json({ error: "A nota deve ser um valor entre 1 e 5." }, { status: 400 });
  }

  if (!db) {
    return adminSdkMissingResponse();
  }

  try {
    const tenantSnap = await db.collection("tenants").where("slug", "==", slug).limit(1).get();
    if (tenantSnap.empty) {
      return Response.json({ error: "Empresa não encontrada." }, { status: 404 });
    }
    const tenantId = tenantSnap.docs[0].id;

    const appointmentRef = db
      .collection("tenants")
      .doc(tenantId)
      .collection("appointments")
      .doc(appointmentId);
    const appointmentSnap = await appointmentRef.get();
    if (!appointmentSnap.exists) {
      return Response.json({ error: "Atendimento não encontrado." }, { status: 404 });
    }
    const appointment = appointmentSnap.data();
    if (!appointment || appointment.status !== "completed") {
      return Response.json(
        { error: "Só é possível avaliar um atendimento já concluído." },
        { status: 400 }
      );
    }

    const reviewsCol = db.collection("tenants").doc(tenantId).collection("reviews");
    const existing = await reviewsCol.where("appointmentId", "==", appointmentId).limit(1).get();
    if (!existing.empty) {
      return Response.json({ error: "Este atendimento já foi avaliado." }, { status: 409 });
    }

    let customerId: string | null = appointment.customerId ?? null;
    const customersCol = db.collection("tenants").doc(tenantId).collection("customers");

    if (name && phone) {
      const match = await customersCol.where("phone", "==", phone).limit(1).get();
      if (match.empty) {
        const ref = await customersCol.add({
          tenantId,
          name,
          phone,
          whatsapp: phone,
          email: null,
          birthDate: null,
          gender: null,
          notes: null,
          tags: [],
          source: "review",
          totalSpent: 0,
          visitCount: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        customerId = ref.id;
      } else {
        customerId = match.docs[0].id;
      }
    }

    await reviewsCol.add({
      tenantId,
      appointmentId,
      customerId,
      rating,
      comment: comment ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });

    await db
      .collection("tenants")
      .doc(tenantId)
      .collection("notifications")
      .add({
        tenantId,
        userId: null,
        type: "system",
        title: "Nova avaliação",
        body: `Um cliente avaliou um atendimento com ${rating} estrela(s)${comment ? ": " + comment.slice(0, 120) : "."}`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Erro interno ao registrar a avaliação." }, { status: 500 });
  }
}
