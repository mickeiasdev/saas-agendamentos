export const AUTH_ERRORS = {
  NAME_REQUIRED: "Informe seu nome.",
  EMAIL_REQUIRED: "Informe um e-mail válido.",
  PASSWORD_MIN: "A senha deve ter pelo menos 6 caracteres.",
  PASSWORD_MISMATCH: "As senhas não coincidem.",
  CURRENT_PASSWORD_REQUIRED: "Informe a senha atual para reautenticar.",
} as const;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateSignup(input: {
  name: string;
  email: string;
  password: string;
  confirm: string;
}): string | null {
  if (!input.name.trim()) return AUTH_ERRORS.NAME_REQUIRED;
  if (!isValidEmail(input.email)) return AUTH_ERRORS.EMAIL_REQUIRED;
  if (input.password.length < 6) return AUTH_ERRORS.PASSWORD_MIN;
  if (input.password !== input.confirm) return AUTH_ERRORS.PASSWORD_MISMATCH;
  return null;
}

export function validateLogin(input: { email: string; password: string }): string | null {
  if (!isValidEmail(input.email)) return AUTH_ERRORS.EMAIL_REQUIRED;
  if (!input.password) return AUTH_ERRORS.PASSWORD_MIN;
  return null;
}

export function validateRecover(email: string): string | null {
  if (!isValidEmail(email)) return AUTH_ERRORS.EMAIL_REQUIRED;
  return null;
}

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirm: string;
}): string | null {
  if (!input.currentPassword) return AUTH_ERRORS.CURRENT_PASSWORD_REQUIRED;
  if (input.newPassword.length < 6) return AUTH_ERRORS.PASSWORD_MIN;
  if (input.newPassword !== input.confirm) return AUTH_ERRORS.PASSWORD_MISMATCH;
  return null;
}
