import type { Metadata } from "next";
import { Alfa_Slab_One, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Hand-painted shop signs for headings, a condensed sports face for everything else.
const sign = Alfa_Slab_One({ variable: "--font-alfa-slab", subsets: ["latin"], weight: "400" });
const body = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "600"] });

export const metadata: Metadata = {
  title: "La Barra",
  description: "Futbolito de mesa en 3D: Atlético La Esquina contra Real Pulpería.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sign.variable} ${body.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
