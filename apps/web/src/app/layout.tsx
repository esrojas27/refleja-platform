import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AmplifyAuthBootstrap } from "@/components/auth/amplify-auth-bootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Refleja Tu Interior",
    template: "%s | Refleja Tu Interior",
  },
  description: "Programas de desarrollo que conectan propósito, acompañamiento y transformación.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full">
        <AmplifyAuthBootstrap>{children}</AmplifyAuthBootstrap>
      </body>
    </html>
  );
}
