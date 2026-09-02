import { getApp, getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebaseConfig } from "./config";

const config = getFirebaseConfig();
let persistenceConfigured = false;

export function initFirebase() {
  if (!config) {
    throw new Error(
      "Firebase não está configurado. Copie .env.example para .env.local e preencha com as credenciais do seu projeto Firebase."
    );
  }
  const app = getApps().length === 0 ? initializeApp(config) : getApp();
  return app;
}

export function getFirebaseAuth() {
  const auth = getAuth(initFirebase());
  if (!persistenceConfigured) {
    persistenceConfigured = true;
    void setPersistence(auth, browserLocalPersistence);
  }
  return auth;
}

export function getFirebaseFirestore() {
  return getFirestore(initFirebase());
}
