import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const runEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST || process.env.RUN_RULES_EMULATOR);

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const [host, portRaw] = EMULATOR_HOST.split(":");
const port = Number(portRaw || 8080);

const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

async function seed(env: RulesTestEnvironment) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "users", "userA"), {
      uid: "userA",
      email: "a@tena.com",
      platformRole: "USER",
    });
    await setDoc(doc(db, "users", "userB"), {
      uid: "userB",
      email: "b@tenb.com",
      platformRole: "USER",
    });
    await setDoc(doc(db, "tenants", "tA"), {
      slug: "tena",
      name: "Empresa A",
      ownerUserId: "userA",
      status: "active",
    });
    await setDoc(doc(db, "tenants", "tB"), {
      slug: "tenb",
      name: "Empresa B",
      ownerUserId: "userB",
      status: "active",
    });
    await setDoc(doc(db, "tenant_users", "userA_tA"), {
      userId: "userA",
      tenantId: "tA",
      role: "TENANT_OWNER",
      status: "active",
    });
    await setDoc(doc(db, "tenant_users", "userB_tB"), {
      userId: "userB",
      tenantId: "tB",
      role: "TENANT_OWNER",
      status: "active",
    });
    await setDoc(doc(db, "slugs", "tena"), { tenantId: "tA" });
    await setDoc(doc(db, "slugs", "tenb"), { tenantId: "tB" });
    await setDoc(doc(db, "tenants", "tA", "customers", "custA"), { name: "Cliente A", tenantId: "tA" });
    await setDoc(doc(db, "tenants", "tB", "customers", "custB"), { name: "Cliente B", tenantId: "tB" });
    await setDoc(doc(db, "tenants", "tA", "services", "svcA"), { name: "Corte A", tenantId: "tA", status: "active" });
    await setDoc(doc(db, "tenants", "tB", "services", "svcB"), { name: "Corte B", tenantId: "tB", status: "active" });
  });
}

describe.skipIf(!runEmulator)("Firestore Rules no emulador — Tenant A não acessa Tenant B", () => {
    let env: RulesTestEnvironment;

    beforeAll(async () => {
      env = await initializeTestEnvironment({
        projectId: "demo-agenda-saas",
        firestore: { rules, host, port },
      });
    });

    afterAll(async () => {
      await env?.cleanup();
    });

    beforeEach(async () => {
      await env.clearFirestore();
      await seed(env);
    });

    it("dono de A lê A e é NEGADO em B", async () => {
      const a = env.authenticatedContext("userA").firestore();
      await assertSucceeds(getDoc(doc(a, "tenants", "tA")));
      await assertSucceeds(getDoc(doc(a, "tenants", "tA", "customers", "custA")));
      await assertFails(getDoc(doc(a, "tenants", "tB")));
      await assertFails(getDoc(doc(a, "tenants", "tB", "customers", "custB")));
      await assertFails(getDoc(doc(a, "tenants", "tB", "services", "svcB")));
    });

    it("dono de B lê B e é NEGADO em A", async () => {
      const b = env.authenticatedContext("userB").firestore();
      await assertSucceeds(getDoc(doc(b, "tenants", "tB")));
      await assertFails(getDoc(doc(b, "tenants", "tA")));
      await assertFails(getDoc(doc(b, "tenants", "tA", "services", "svcA")));
    });

    it("anônimo não lê tenants nem subcoleções", async () => {
      const anon = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(anon, "tenants", "tA")));
      await assertFails(getDoc(doc(anon, "tenants", "tA", "customers", "custA")));
    });

    it("duas empresas não podem gravar o mesmo slug", async () => {
      const a = env.authenticatedContext("userA").firestore();
      await assertFails(setDoc(doc(a, "slugs", "tenb"), { tenantId: "tA" }));
      await assertSucceeds(setDoc(doc(a, "slugs", "tena-nova"), { tenantId: "tA" }));
    });

    it("cliente não cria TENANT_ADMIN/MANAGER — só TENANT_OWNER no onboarding", async () => {
      const a = env.authenticatedContext("userA").firestore();
      await assertFails(
        setDoc(doc(a, "tenant_users", "userB_tA"), {
          userId: "userB",
          tenantId: "tA",
          role: "TENANT_ADMIN",
          status: "active",
        })
      );
      await assertFails(
        setDoc(doc(a, "tenant_users", "userA_tA"), {
          userId: "userA",
          tenantId: "tA",
          role: "MANAGER",
          status: "active",
        })
      );
    });

    it("convites são opacos no cliente (somente Admin SDK)", async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), "invites", "tok1"), {
          tenantId: "tA",
          email: "x@y.com",
          role: "MANAGER",
          status: "pending",
        });
      });
      const a = env.authenticatedContext("userA").firestore();
      await assertFails(getDoc(doc(a, "invites", "tok1")));
      await assertFails(
        setDoc(doc(a, "invites", "tok2"), {
          tenantId: "tA",
          email: "z@y.com",
          role: "MANAGER",
          status: "pending",
        })
      );
    });

    it("membro de A não altera o slug do tenant", async () => {
      const a = env.authenticatedContext("userA").firestore();
      await assertFails(
        setDoc(doc(a, "tenants", "tA"), {
          slug: "tenb",
          name: "Empresa A",
          ownerUserId: "userA",
          status: "active",
        })
      );
    });

    it("usuário não se promove a PLATFORM_OWNER no cliente", async () => {
      const a = env.authenticatedContext("userA").firestore();
      await assertFails(
        setDoc(doc(a, "users", "userA"), {
          uid: "userA",
          email: "a@tena.com",
          platformRole: "PLATFORM_OWNER",
        })
      );
    });
  });
