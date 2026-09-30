import type { Metadata } from "next";
import { Alfa_Slab_One, Barlow_Condensed } from "next/font/google";
import "./globals.css";

// Hand-painted shop signs for headings, a condensed sports face for everything else.
const sign = Alfa_Slab_One({ variable: "--font-alfa-slab", subsets: ["latin"], weight: "400" });
const body = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["400", "600"] });

const title = "La Barra · Futbolito de pulpería";
const description = "Futbolito de mesa en 3D, gratis en el navegador: contra la compu, 2 jugadores en el mismo teclado o en línea con un código de sala.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", locale: "es_HN", siteName: "La Barra" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sign.variable} ${body.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
