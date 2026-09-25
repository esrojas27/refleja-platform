import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import type { ReactNode } from "react";

import { AmplifyAuthBootstrap } from "@/components/auth/amplify-auth-bootstrap";

import "./globals.css";

const editorial = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  display: "swap",
});

const functional = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Refleja Tu Interior",
    template: "%s | Refleja Tu Interior",
  },
  description: "Programas de desarrollo que conectan propósito, acompañamiento y transformación.",
  icons: {
    icon: [{ url: "/brand/RP_CIRCULAR.jpeg", type: "image/jpeg" }],
    apple: [{ url: "/brand/RP_CIRCULAR.jpeg", type: "image/jpeg" }],
  },
  openGraph: {
    title: "Refleja Tu Interior",
    description: "Programas de desarrollo que conectan propósito, acompañamiento y transformación.",
    images: [{ url: "/brand/RP_CUADRADO_B.jpeg", width: 500, height: 500, alt: "Refleja Tu Interior" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${functional.variable} ${editorial.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AmplifyAuthBootstrap>{children}</AmplifyAuthBootstrap>
      </body>
    </html>
  );
}
