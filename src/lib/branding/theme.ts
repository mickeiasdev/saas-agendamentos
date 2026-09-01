export type PublicThemeName = "light" | "dark";

export interface PublicThemeClasses {
  dark: boolean;
  page: string;
  header: string;
  heading: string;
  muted: string;
  body: string;
  card: string;
  footer: string;
  panel: string;
  divider: string;
  input: string;
}

export function publicThemeClasses(theme: PublicThemeName | undefined): PublicThemeClasses {
  if (theme === "dark") {
    return {
      dark: true,
      page: "min-h-screen bg-slate-950 text-slate-100",
      header: "border-b border-slate-800 bg-slate-950",
      heading: "text-slate-50",
      muted: "text-slate-400",
      body: "text-slate-300",
      card: "rounded-xl border border-slate-800 bg-slate-900 p-5",
      footer: "border-t border-slate-800",
      panel: "rounded-lg bg-slate-900 p-3",
      divider: "divide-slate-800 border-slate-800",
      input:
        "w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500",
    };
  }
  return {
    dark: false,
    page: "min-h-screen bg-white text-slate-900",
    header: "border-b border-slate-100 bg-white",
    heading: "text-slate-900",
    muted: "text-slate-500",
    body: "text-slate-600",
    card: "rounded-xl border border-slate-200 bg-white p-5",
    footer: "border-t border-slate-100",
    panel: "rounded-lg bg-slate-100 p-3",
    divider: "divide-slate-100 border-slate-200",
    input:
      "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400",
  };
}
