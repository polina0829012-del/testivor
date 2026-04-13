import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Interview Intelligence Platform",
  description: "Планы интервью, протоколы, AI-сводки и расхождения",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
