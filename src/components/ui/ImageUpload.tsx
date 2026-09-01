"use client";

import { useState } from "react";
import { uploadTenantImage, type TenantUploadKind } from "@/lib/storage/upload";

interface ImageUploadProps {
  tenantId: string;
  kind: TenantUploadKind;
  value?: string;
  disabled?: boolean;
  round?: boolean;
  label?: string;
  onChange: (url: string) => void;
}

export function ImageUpload({
  tenantId,
  kind,
  value,
  disabled,
  round,
  label = "Imagem",
  onChange,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadTenantImage(tenantId, kind, file);
      onChange(url);
    } catch (err) {
      setError((err as Error).message ?? "Falha no upload.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className={`h-14 w-14 object-cover ${round ? "rounded-full" : "rounded-lg"}`}
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            className={`flex h-14 w-14 items-center justify-center bg-slate-100 text-xs text-slate-400 ${
              round ? "rounded-full" : "rounded-lg"
            }`}
          >
            —
          </span>
        )}
        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={disabled || uploading || !tenantId}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
          <p className="mt-1 text-xs text-slate-400">
            {uploading ? "Enviando..." : "JPG, PNG, WEBP ou GIF até 5 MB."}
          </p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
