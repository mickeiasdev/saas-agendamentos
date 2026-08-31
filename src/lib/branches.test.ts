import { describe, expect, it } from "vitest";
import {
  applyMainBranch,
  branchHasDuplicateName,
  isBranchNameValid,
  toggleBranchActive,
  validateBranch,
} from "./branches";
import type { Branch } from "@/types";

function makeBranch(overrides: Partial<Branch> = {}): Branch {
  const now = new Date();
  return {
    id: `branch-${Math.random().toString(36).slice(2, 8)}`,
    tenantId: "tenant-a",
    name: "Unidade Centro",
    active: true,
    isMain: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("branches (Fase 3.1)", () => {
  it("valida nome com no mínimo 2 caracteres", () => {
    expect(isBranchNameValid("Loja")).toBe(true);
    expect(isBranchNameValid("A")).toBe(false);
    expect(isBranchNameValid("  ")).toBe(false);
  });

  it("detecta nomes duplicados ignorando capitalização e espaços", () => {
    const branches = [makeBranch({ id: "b1", name: "Centro" })];
    expect(branchHasDuplicateName(branches, "centro", undefined)).toBe(true);
    expect(branchHasDuplicateName(branches, "  CENTRO ", undefined)).toBe(true);
    expect(branchHasDuplicateName(branches, "Zona Sul", undefined)).toBe(false);
    expect(branchHasDuplicateName(branches, "Centro", "b1")).toBe(false);
  });

  it("promove uma unidade a principal e demove as demais", () => {
    const branches = [
      makeBranch({ id: "b1", isMain: true }),
      makeBranch({ id: "b2" }),
      makeBranch({ id: "b3" }),
    ];
    const result = applyMainBranch(branches, "b2", true);
    expect(result.find((b) => b.id === "b2")?.isMain).toBe(true);
    expect(result.filter((b) => b.isMain)).toHaveLength(1);
    expect(result.find((b) => b.id === "b1")?.isMain).toBe(false);
  });

  it("impede desativar a unidade principal sem alternativa ativa", () => {
    const branches = [makeBranch({ id: "b1", isMain: true })];
    const result = toggleBranchActive(branches, "b1", false);
    expect(result.error).toBeDefined();
    expect(result.branches[0].active).toBe(true);
  });

  it("desativa a principal e promove outra automaticamente", () => {
    const branches = [
      makeBranch({ id: "b1", isMain: true }),
      makeBranch({ id: "b2" }),
    ];
    const result = toggleBranchActive(branches, "b1", false);
    expect(result.error).toBeUndefined();
    expect(result.branches.find((b) => b.id === "b1")?.active).toBe(false);
    expect(result.branches.find((b) => b.id === "b2")?.isMain).toBe(true);
  });

  it("valida entrada de criação/edição", () => {
    const branches = [makeBranch({ id: "b1", name: "Centro" })];
    expect(validateBranch(branches, { name: "Zona Norte" }).ok).toBe(true);
    expect(validateBranch(branches, { name: "centro" }).ok).toBe(false);
    expect(validateBranch(branches, { name: "x" }).ok).toBe(false);
  });
});
