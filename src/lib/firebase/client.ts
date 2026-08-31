import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebaseConfig } from "./config";

const config = getFirebaseConfig();

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
  return getAuth(initFirebase());
}

export function getFirebaseFirestore() {
  return getFirestore(initFirebase());
}

export function getFirebaseStorage() {
  return getStorage(initFirebase());
}
