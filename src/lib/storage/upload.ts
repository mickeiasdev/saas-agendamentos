export type TenantUploadKind = "logo" | "banner" | "services" | "professionals";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;

const PRESETS: Record<
  TenantUploadKind,
  { maxWidth: number; maxHeight: number; maxBytes: number; quality: number }
> = {
  logo: { maxWidth: 256, maxHeight: 256, maxBytes: 80 * 1024, quality: 0.78 },
  banner: { maxWidth: 1200, maxHeight: 480, maxBytes: 150 * 1024, quality: 0.76 },
  services: { maxWidth: 640, maxHeight: 640, maxBytes: 100 * 1024, quality: 0.76 },
  professionals: { maxWidth: 400, maxHeight: 400, maxBytes: 80 * 1024, quality: 0.78 },
};

export function dataUrlByteLength(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const b64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

export function isInlineImageUrl(value: string | undefined | null): boolean {
  return typeof value === "string" && value.startsWith("data:image/");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler a imagem."));
    };
    img.src = url;
  });
}

function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export async function compressImageFile(
  file: File,
  kind: TenantUploadKind
): Promise<string> {
  if (!ALLOWED.includes(file.type)) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP ou GIF.");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("A imagem deve ter no máximo 8 MB.");
  }

  const preset = PRESETS[kind];
  const img = await loadImage(file);
  const ratio = Math.min(preset.maxWidth / img.width, preset.maxHeight / img.height, 1);
  const width = Math.max(1, Math.round(img.width * ratio));
  const height = Math.max(1, Math.round(img.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem neste navegador.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = preset.quality;
  let dataUrl = canvasToJpegDataUrl(canvas, quality);
  let bytes = dataUrlByteLength(dataUrl);

  while (bytes > preset.maxBytes && quality > 0.4) {
    quality -= 0.08;
    dataUrl = canvasToJpegDataUrl(canvas, quality);
    bytes = dataUrlByteLength(dataUrl);
  }

  if (bytes > preset.maxBytes) {
    const scale = Math.sqrt(preset.maxBytes / bytes);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    quality = 0.62;
    dataUrl = canvasToJpegDataUrl(canvas, quality);
    bytes = dataUrlByteLength(dataUrl);
    while (bytes > preset.maxBytes && quality > 0.35) {
      quality -= 0.07;
      dataUrl = canvasToJpegDataUrl(canvas, quality);
      bytes = dataUrlByteLength(dataUrl);
    }
  }

  if (bytes > preset.maxBytes) {
    throw new Error("Não foi possível comprimir a imagem o bastante. Tente um arquivo menor.");
  }

  return dataUrl;
}

export async function uploadTenantImage(
  _tenantId: string,
  kind: TenantUploadKind,
  file: File
): Promise<string> {
  return compressImageFile(file, kind);
}
