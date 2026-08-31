/**
 * Abstração de armazenamento de arquivos.
 * Provider real inicial: Firebase Storage.
 */

export interface StorageProvider {
  readonly id: string;
  isEnabled(): boolean;
  upload(path: string, file: Blob | Uint8Array): Promise<string>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): Promise<string>;
}
