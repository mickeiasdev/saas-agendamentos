export const GOOGLE_PROVIDER_ID = "google.com";
export const PASSWORD_PROVIDER_ID = "password";

export function hasPasswordProvider(
  user: { providerData?: Array<{ providerId: string }> } | null | undefined
): boolean {
  return Boolean(user?.providerData?.some((p) => p.providerId === PASSWORD_PROVIDER_ID));
}

export function hasGoogleProvider(
  user: { providerData?: Array<{ providerId: string }> } | null | undefined
): boolean {
  return Boolean(user?.providerData?.some((p) => p.providerId === GOOGLE_PROVIDER_ID));
}

export function isPopupFallbackError(code: string): boolean {
  return code === "auth/popup-blocked" || code === "auth/cancelled-popup-request";
}
