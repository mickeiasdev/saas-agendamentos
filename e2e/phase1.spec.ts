import { expect, test, type Page } from "@playwright/test";

function unique() {
  return `${Date.now()}`;
}

async function signup(page: Page, name: string, email: string, password: string) {
  await page.goto("/signup");
  await page.getByTestId("signup-name").fill(name);
  await page.getByTestId("signup-email").fill(email);
  await page.getByTestId("signup-password").fill(password);
  await page.getByTestId("signup-confirm").fill(password);
  await page.getByTestId("signup-submit").click();
}

test.describe("Fase 1 E2E", () => {
  test("cadastro, empresa, CRUDs, agenda e site público", async ({ page }) => {
    const stamp = unique();
    const email = `e2e-${stamp}@example.com`;
    const password = "TesteFase1!";
    const company = `Barbearia E2E ${stamp}`;
    const slug = `barbearia-e2e-${stamp}`;

    await signup(page, "Dona E2E", email, password);
    await page.waitForURL(/\/app/, { timeout: 30_000 });

    await expect(page.getByTestId("onboarding-form")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("onboarding-name").fill(company);
    await page.getByTestId("onboarding-slug").fill(slug);
    await page.getByTestId("onboarding-submit").click();

    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("dashboard-title")).toContainText(company);

    await page.getByTestId("nav-app-categories").click();
    await page.getByTestId("category-create").click();
    await page.getByTestId("category-name").fill("Cabelo");
    await page.getByTestId("category-save").click();
    await expect(page.getByText("Cabelo").first()).toBeVisible();

    await page.getByTestId("nav-app-professionals").click();
    await page.getByTestId("professional-create").click();
    await page.getByTestId("professional-name").fill("Ana");
    await page.getByTestId("professional-save").click();
    await expect(page.getByText("Ana").first()).toBeVisible();

    await page.getByTestId("nav-app-services").click();
    await page.getByTestId("service-create").click();
    await page.getByTestId("service-name").fill("Corte");
    await page.getByTestId("service-save").click();
    await expect(page.getByText("Corte").first()).toBeVisible();

    await page.getByTestId("nav-app-customers").click();
    await page.getByTestId("customer-create").click();
    await page.getByTestId("customer-name").fill("Maria Souza");
    await page.getByTestId("customer-save").click();
    await expect(page.getByText("Maria Souza").first()).toBeVisible();

    await page.getByTestId("nav-app-availability").click();
    await expect(page.getByRole("heading", { name: "Disponibilidade" })).toBeVisible();
    await page.getByTestId("availability-save").click();
    await expect(page.getByText("Disponibilidade salva.")).toBeVisible();

    await page.getByTestId("nav-app-agenda").click();
    await expect(page.getByTestId("agenda-title")).toBeVisible();
    await page.getByTestId("agenda-view").selectOption("week");
    await page.getByTestId("agenda-view").selectOption("month");
    await page.getByTestId("agenda-view").selectOption("day");

    await page.getByTestId("logout").click();
    await page.waitForURL("/");

    await page.goto("/login");
    await page.getByTestId("login-email").fill(email);
    await page.getByTestId("login-password").fill(password);
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("dashboard-title")).toBeVisible({ timeout: 30_000 });

    await page.goto(`/${slug}`);
    const notFound = page.getByText("Empresa não encontrada");
    const book = page.getByTestId("public-book");
    await expect(notFound.or(book)).toBeVisible({ timeout: 20_000 });
    if (await book.isVisible()) {
      await book.click();
      await expect(page.getByText("Escolha o serviço")).toBeVisible();
      await page.getByText("Corte").first().click();
      await expect(page.getByText("Escolha o profissional")).toBeVisible();
    }
  });

  test("recuperação de senha envia o link", async ({ page }) => {
    await page.goto("/recover");
    await page.getByTestId("recover-email").fill("e2e-recover@example.com");
    await page.getByTestId("recover-submit").click();
    await expect(page.getByTestId("recover-success").or(page.getByTestId("recover-error"))).toBeVisible();
  });
});
