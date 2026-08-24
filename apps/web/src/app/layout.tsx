import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Refleja Tu Interior",
  description: "Plataforma Refleja Tu Interior",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-muted/30">{children}</body>
    </html>
  );
}
