/**
 * Abstração de provedores de autenticação.
 * Hoje o provider real é o Firebase Authentication, mas qualquer outro
 * provedor pode ser plugado sem reescrever a aplicação.
 */

export interface AuthUserLike {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthProvider {
  readonly id: "firebase" | "custom";
  isEnabled(): boolean;
  signIn(email: string, password: string): Promise<AuthUserLike>;
  signUp(email: string, password: string, displayName: string): Promise<AuthUserLike>;
  signOut(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  getCurrentUser(): AuthUserLike | null;
  onAuthStateChanged(cb: (user: AuthUserLike | null) => void): () => void;
}
