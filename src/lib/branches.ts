import type { Branch } from "@/types";

/**
 * Multiunidades (Fase 3.1).
 *
 * Lógica pura para gestão de unidades (branches) de uma empresa. Garante
 * invariantes como: apenas uma unidade principal por tenant, validação de
 * nomes duplicados e regras de ativação/desativação.
 */

export function isBranchNameValid(name: string): boolean {
  return name.trim().length >= 2;
}

export function branchHasDuplicateName(branches: Branch[], name: string, ignoreId?: string): boolean {
  const normalized = name.trim().toLowerCase();
  return branches.some(
    (b) => b.name.trim().toLowerCase() === normalized && b.id !== ignoreId
  );
}

/**
 * Garante que exatamente uma unidade é a principal. Se `makeMain` for true,
 * todas as outras são demovidas. Se a unidade sendo desativada é a principal,
 * `makeMain` deve ser passado para apontar a próxima.
 */
export function applyMainBranch(
  branches: Branch[],
  targetId: string,
  makeMain: boolean
): Branch[] {
  return branches.map((b) => {
    if (b.id === targetId) {
      return { ...b, isMain: makeMain };
    }
    return makeMain ? { ...b, isMain: false } : b;
  });
}

export interface BranchToggleResult {
  branches: Branch[];
  error?: string;
}

/**
 * Desativa uma unidade. A unidade principal não pode ser desativada sem
 * antes apontar outra unidade como principal.
 */
export function toggleBranchActive(
  branches: Branch[],
  targetId: string,
  active: boolean
): BranchToggleResult {
  const target = branches.find((b) => b.id === targetId);
  if (!target) return { branches, error: "Unidade não encontrada." };
  if (target.active === active) return { branches };
  if (!active && target.isMain) {
    const alternatives = branches.filter((b) => b.id !== targetId && b.active);
    if (alternatives.length === 0) {
      return {
        branches,
        error: "A unidade principal não pode ser desativada sem outra unidade ativa.",
      };
    }
    const nextMain = alternatives[0];
    const updated = branches.map((b) =>
      b.id === targetId
        ? { ...b, active: false, isMain: false }
        : b.id === nextMain.id
          ? { ...b, isMain: true }
          : b
    );
    return { branches: updated };
  }
  return {
    branches: branches.map((b) => (b.id === targetId ? { ...b, active } : b)),
  };
}

/** Valida uma operação de criação/edição de unidade. */
export function validateBranch(
  branches: Branch[],
  input: { name: string; id?: string }
): { ok: boolean; error?: string } {
  if (!isBranchNameValid(input.name)) {
    return { ok: false, error: "Informe um nome com pelo menos 2 caracteres." };
  }
  if (branchHasDuplicateName(branches, input.name, input.id)) {
    return { ok: false, error: "Já existe uma unidade com este nome." };
  }
  return { ok: true };
}
