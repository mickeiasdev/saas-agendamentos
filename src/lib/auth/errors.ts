export function authErrorCode(err: unknown): string {
  if (typeof err === "object" && err && "code" in err) {
    return String((err as { code: unknown }).code ?? "");
  }
  return "";
}

export function mapAuthError(err: unknown): string {
  const code = authErrorCode(err);
  switch (code) {
    case "auth/email-already-in-use":
      return "Este e-mail já está em uso.";
    case "auth/invalid-email":
      return "Informe um e-mail válido.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha inválidos.";
    case "auth/too-many-requests":
      return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "Login com Google cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou o popup do Google. Permita popups ou tente de novo.";
    case "auth/operation-not-allowed":
      return "Login com Google não está habilitado neste projeto Firebase.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase Authentication.";
    case "auth/account-exists-with-different-credential":
      return "Já existe uma conta com este e-mail. Entre com e-mail e senha.";
    case "auth/network-request-failed":
      return "Falha de rede. Verifique a conexão e tente de novo.";
    default:
      return err instanceof Error && err.message ? err.message : "Erro de autenticação.";
  }
}
