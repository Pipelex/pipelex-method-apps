import type { Metadata } from "next";
import { SITE } from "@/site";
// The shadcn semantic tokens the form kernel's controls are written against —
// CSS variables only, no preflight, so it is safe beside this app's own Tailwind
// build. Imported first so anything in globals.css can override a token.
import "@pipelex/mthds-form/theme.css";
import "./globals.css";

export const metadata: Metadata = {
  title: SITE.title,
  description: SITE.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
