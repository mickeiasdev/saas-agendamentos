import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type User,
  EmailAuthProvider,
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { authErrorCode, mapAuthError } from "@/lib/auth/errors";
import { isPopupFallbackError } from "@/lib/auth/google";
import type { UserProfile } from "@/types";

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<UserProfile>;
  loginWithGoogle: () => Promise<{ redirected: boolean }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function createProfile(
  uid: string,
  email: string,
  displayName?: string,
  photoUrl?: string
): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const profile: UserProfile = {
    uid,
    email,
    displayName,
    photoUrl,
    platformRole: "USER",
    createdAt: serverTimestamp() as never,
  };
  await setDoc(ref, profile);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrapPlatformRole = useCallback(async (u: User) => {
    try {
      const token = await u.getIdToken();
      const res = await fetch("/api/app/bootstrap", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
    } catch {
      return;
    }
  }, []);

  const loadProfile = useCallback(async (uid: string) => {
    const db = getFirebaseFirestore();
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await createProfile(u.uid, u.email ?? "", u.displayName ?? undefined, u.photoURL ?? undefined);
        await bootstrapPlatformRole(u);
        await loadProfile(u.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    void getRedirectResult(auth).catch(() => undefined);
    return () => unsub();
  }, [configured, loadProfile, bootstrapPlatformRole]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      try {
        const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
        await updateProfile(cred.user, { displayName });
        await sendEmailVerification(cred.user);
        await createProfile(cred.user.uid, email, displayName);
        await bootstrapPlatformRole(cred.user);
        const db = getFirebaseFirestore();
        const snap = await getDoc(doc(db, "users", cred.user.uid));
        const p = snap.data() as UserProfile;
        setProfile(p);
        return p;
      } catch (err) {
        throw new Error(mapAuthError(err));
      }
    },
    [bootstrapPlatformRole]
  );

  const loginWithGoogle = useCallback(async () => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const cred = await signInWithPopup(auth, provider);
      await createProfile(
        cred.user.uid,
        cred.user.email ?? "",
        cred.user.displayName ?? undefined,
        cred.user.photoURL ?? undefined
      );
      await bootstrapPlatformRole(cred.user);
      await loadProfile(cred.user.uid);
      return { redirected: false };
    } catch (err) {
      if (isPopupFallbackError(authErrorCode(err))) {
        await signInWithRedirect(auth, provider);
        return { redirected: true };
      }
      throw new Error(mapAuthError(err));
    }
  }, [bootstrapPlatformRole, loadProfile]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email);
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const auth = getFirebaseAuth();
    const current = auth.currentUser;
    if (!current || !current.email) throw new Error("Usuário não autenticado");
    try {
      const credential = EmailAuthProvider.credential(current.email, currentPassword);
      await reauthenticateWithCredential(current, credential);
      await updatePassword(current, newPassword);
    } catch (err) {
      throw new Error(mapAuthError(err));
    }
  }, []);

  const verifyEmail = useCallback(async () => {
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("Usuário não autenticado");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.uid);
  }, [user, loadProfile]);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      configured,
      login,
      register,
      loginWithGoogle,
      logout,
      resetPassword,
      changePassword,
      verifyEmail,
      refreshProfile,
    }),
    [user, profile, loading, configured, login, register, loginWithGoogle, logout, resetPassword, changePassword, verifyEmail, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
