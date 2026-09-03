import { expect, test } from "@playwright/test";

test.describe("Login Google", () => {
  test("botão Google aparece no login e no cadastro", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByTestId("google-login")).toBeVisible();
    await expect(page.getByTestId("google-login")).toHaveText(/Continuar com Google/i);

    await page.goto("/signup");
    await expect(page.getByTestId("google-login")).toBeVisible();
    await expect(page.getByTestId("google-login")).toHaveText(/Cadastrar com Google/i);
  });

  test("clicar em Google inicia o fluxo (popup, redirect ou erro do provedor)", async ({ page }) => {
    await page.goto("/login");
    const popupPromise = page.waitForEvent("popup", { timeout: 8_000 }).catch(() => null);
    await page.getByTestId("google-login").click();
    const popup = await popupPromise;
    const error = page.getByTestId("google-login-error");
    const redirected = page.url().includes("accounts.google.com") || page.url().includes("google.com");
    const visibleError = await error.isVisible().catch(() => false);
    expect(Boolean(popup) || redirected || visibleError).toBe(true);
    if (visibleError) {
      await expect(error).toContainText(/Google|domínio|popup|projeto Firebase/i);
    }
  });
});
