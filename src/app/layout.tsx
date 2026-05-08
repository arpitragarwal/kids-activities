import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SOURCES } from "@/lib/sources";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-dm-sans",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "Bay Area Kids Activities",
  description: "Activities for little kids in Mountain View and the Bay Area",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased bg-[#faf9f6]">
        <div className="max-w-[680px] mx-auto px-5 pb-16">
          <header className="flex items-center justify-between py-5 border-b border-stone-200 mb-6">
            <div className="flex flex-col gap-0.5">
              <Link href="/" className="flex items-center gap-2.5 text-stone-900 no-underline">
                {/* Child + sprout mark */}
                <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                  {/* sprout stem + leaves */}
                  <path d="M44 56 C44 44 40 38 44 28" stroke="#3F7A55" strokeWidth="2.6" strokeLinecap="round" />
                  <path d="M44 38 C38 36 32 38 32 44 C36 46 42 45 44 38 Z" fill="#5C9A6F" />
                  <path d="M44 32 C50 30 56 32 56 38 C52 40 46 39 44 32 Z" fill="#5C9A6F" />
                  <circle cx="44" cy="26" r="3" fill="#3F7A55" />
                  {/* child body */}
                  <path d="M10 56 C10 40 14 28 22 28 C26 28 28 30 28 34 L28 42 C28 46 30 48 32 48 L36 48 L36 56 Z" fill="#C2724A" />
                  {/* head */}
                  <circle cx="20" cy="22" r="7" fill="#E5B89C" />
                  <path d="M13 22 C13 16 16 13 20 13 C25 13 28 16 28 22 C25 19 20 19 16 21 C15 21 14 22 13 22 Z" fill="#3A2A22" />
                </svg>
                <span className="text-[17px] font-semibold tracking-tight">Kids Activities Near You</span>
              </Link>
              <p className="text-[11px] text-stone-400 pl-[52px]">
                Created by{" "}
                <a
                  href="https://www.linkedin.com/in/arpit-agarwal/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-stone-600 underline underline-offset-2 transition-colors"
                >
                  Arpit Agarwal
                </a>
              </p>
            </div>
            <Link href="/health" className="flex items-center gap-1.5 text-[12px] text-stone-400 hover:text-stone-600 transition-colors">
              Sources
              <span className="font-mono text-[10px] bg-stone-100 text-stone-500 rounded px-1 py-0.5">{SOURCES.length}</span>
            </Link>
          </header>
          {children}
          <footer className="mt-12 pt-4 border-t border-stone-200 text-[11px] text-stone-400 flex items-center justify-between">
            <span>Live data — refreshed hourly.</span>
            <a href="/api/refresh" className="hover:text-stone-600 transition-colors">Refresh →</a>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
