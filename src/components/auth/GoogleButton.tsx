"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

export function GoogleButton({
  label = "Continuar com Google",
  onSuccess,
}: {
  label?: string;
  onSuccess?: () => void;
}) {
  const { loginWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setError("");
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      if (!result.redirected) onSuccess?.();
    } catch (err) {
      setError((err as Error).message ?? "Erro ao entrar com Google.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        data-testid="google-login"
        onClick={() => void handleClick()}
        disabled={loading}
        className="btn-secondary w-full"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.85-.07-1.67-.21-2.46H12v4.66h6.46c-.28 1.5-1.12 2.77-2.39 3.62v3.01h3.87c2.26-2.08 3.55-5.14 3.55-8.83z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3.01c-1.08.72-2.46 1.15-4.08 1.15-3.14 0-5.8-2.12-6.75-4.97H1.25v3.12C3.23 21.3 7.31 24 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.25 14.27A7.2 7.2 0 0 1 4.87 12c0-.79.14-1.56.38-2.27V6.61H1.25A11.98 11.98 0 0 0 0 12c0 1.94.46 3.77 1.25 5.39l4-3.12z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.23 2.7 1.25 6.61l4 3.12C6.2 6.87 8.86 4.75 12 4.75z"
          />
        </svg>
        {loading ? "Conectando..." : label}
      </button>
      {error && (
        <p data-testid="google-login-error" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
