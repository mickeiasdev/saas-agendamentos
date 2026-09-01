import { NextRequest, NextResponse } from "next/server";
import { getAdminFirestore } from "@/lib/server/firebaseAdmin";
import { requirePlatformRole } from "@/lib/server/guard";
import { createApiKey, listApiKeys, validateCreateApiKeyInput } from "@/lib/server/apiKeys";

export const dynamic = "force-dynamic";

/**
 * /api/master/tenants/[id]/api-keys (Fase 3.13)
 * GET  — lista as API keys de uma empresa
 * POST — cria uma API key (o segredo é retornado apenas uma vez)
 * Requer papel PLATFORM_ADMIN ou PLATFORM_OWNER.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  const tenantId = params.id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  try {
    const keys = await listApiKeys(db, tenantId);
    return NextResponse.json({ tenantId, items: keys });
  } catch {
    return NextResponse.json({ error: "Erro interno ao carregar as API keys." }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requirePlatformRole(req, "PLATFORM_ADMIN");
  if (guard.error) return guard.error;
  const db = getAdminFirestore()!;

  const tenantId = params.id?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Parâmetro inválido." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  }

  const validation = validateCreateApiKeyInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  try {
    const result = await createApiKey(db, tenantId, validation.data);
    return NextResponse.json(
      { tenantId, apiKeyId: result.apiKeyId, secret: result.secret },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Erro interno ao criar a API key." }, { status: 500 });
  }
}
