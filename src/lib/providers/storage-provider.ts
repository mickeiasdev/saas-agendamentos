/**
 * Abstração de armazenamento de arquivos.
 * Provider inicial: imagens comprimidas (data URL) gravadas no Firestore.
 * Firebase Storage fica como opção futura — o plano Spark exigiria ativar
 * um serviço extra; o MVP não depende dele.
 */

export interface StorageProvider {
  readonly id: string;
  isEnabled(): boolean;
  upload(path: string, file: Blob | Uint8Array): Promise<string>;
  delete(path: string): Promise<void>;
  getPublicUrl(path: string): Promise<string>;
}
