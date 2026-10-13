import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { ModeBanner } from "@/components/ModeBanner";
import { serverQlooMode } from "@/lib/qloo";
import { hasAnthropicKey } from "@/lib/llm";

// The banner depends on runtime keys, so render per request (not baked in at build time).
export const dynamic = "force-dynamic";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TasteBridge: taste-graph localization advisor for Taiwan → Japan",
  description: "An agent that uses Qloo's taste graph to tell Taiwanese brands where and how they fit in Japan, with every claim tied to evidence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <ModeBanner mode={serverQlooMode()} anthropic={hasAnthropicKey()} />
        <Nav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
        <footer className="border-t border-stone-200 px-4 py-6 text-center text-xs text-stone-500">
          Taste data: Qloo Taste AI (hackathon API). Map data © OpenStreetMap contributors. MIT licensed.
        </footer>
      </body>
    </html>
  );
}
