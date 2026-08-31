import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "Agenda SaaS — Plataforma de agendamentos para empresas",
    template: "%s | Agenda SaaS",
  },
  description:
    "Plataforma SaaS multi-tenant de agendamentos. Site público, agenda, clientes, serviços e profissionais para o seu negócio.",
  applicationName: "Agenda SaaS",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
