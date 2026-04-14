import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { criticalAppCss } from "@/lib/critical-app-css";
import "./globals.css";
import { GlobalStyles } from "./global-styles";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Interview Intelligence Platform",
  description: "Планы интервью, протоколы, AI-сводки и расхождения",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: criticalAppCss }} />
      </head>
      <body className={`${inter.variable} min-h-screen font-sans antialiased`} suppressHydrationWarning>
        <GlobalStyles />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
