import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseStorage } from "@/lib/firebase/client";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type TenantUploadKind = "logo" | "banner" | "services" | "professionals";

export async function uploadTenantImage(
  tenantId: string,
  kind: TenantUploadKind,
  file: File
): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("A imagem deve ter no máximo 5 MB.");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `tenants/${tenantId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, file, { contentType: file.type });
  return getDownloadURL(storageRef);
}
