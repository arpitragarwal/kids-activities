import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import Link from "next/link";

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
  title: "Kids activities near me",
  description: "Activities for little kids in Mountain View and nearby cities",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased">
        <div className="max-w-[680px] mx-auto px-5 pb-16">
          <header className="flex items-center py-5 border-b border-stone-200 mb-6">
            <Link href="/" className="flex items-center gap-2 text-stone-900 no-underline">
              <div className="w-[30px] h-[30px] bg-[#4a6fa5] rounded-lg flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="6" r="3" fill="white" opacity="0.9" />
                  <path
                    d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </svg>
              </div>
              <span className="text-[17px] font-semibold tracking-tight">Kids activities near me</span>
            </Link>
          </header>
          {children}
          <footer className="mt-12 pt-4 border-t border-stone-200 text-xs text-stone-400 flex items-center justify-between">
            <span>Live data — refreshed hourly via cron.</span>
            <div className="flex items-center gap-3">
              <Link href="/health" className="hover:text-stone-600 transition-colors">Sources</Link>
              <a href="/api/refresh" className="hover:text-stone-600 transition-colors">Refresh now →</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
