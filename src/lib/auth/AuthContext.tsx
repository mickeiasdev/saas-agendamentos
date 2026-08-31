import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type User,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import type { UserProfile } from "@/types";

export interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  configured: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  verifyEmail: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

async function createProfile(uid: string, email: string, displayName?: string): Promise<void> {
  const db = getFirebaseFirestore();
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const profile: UserProfile = {
    uid,
    email,
    displayName,
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
        await createProfile(u.uid, u.email ?? "", u.displayName ?? undefined);
        await loadProfile(u.uid);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [configured, loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getFirebaseAuth(), email, password);
  }, []);

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      await updateProfile(cred.user, { displayName });
      await createProfile(cred.user.uid, email, displayName);
      const db = getFirebaseFirestore();
      const snap = await getDoc(doc(db, "users", cred.user.uid));
      const p = snap.data() as UserProfile;
      setProfile(p);
      return p;
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
    setProfile(null);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(getFirebaseAuth(), email);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const auth = getFirebaseAuth();
    if (!auth.currentUser) throw new Error("Usuário não autenticado");
    await updatePassword(auth.currentUser, newPassword);
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
      logout,
      resetPassword,
      changePassword,
      verifyEmail,
      refreshProfile,
    }),
    [user, profile, loading, configured, login, register, logout, resetPassword, changePassword, verifyEmail, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
