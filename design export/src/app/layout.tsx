import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "MV Kids",
  description: "Activities for little kids in Mountain View",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="max-w-2xl mx-auto px-5 pb-16">
          <header className="flex items-center justify-between py-5 border-b border-stone-200 mb-6">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 text-stone-900 no-underline">
              <span className="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center shrink-0">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="6" r="3" fill="white" opacity="0.9" />
                  <path
                    d="M3 14c0-2.76 2.24-5 5-5s5 2.24 5 5"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.7"
                  />
                </svg>
              </span>
              <span className="text-[17px] font-semibold tracking-tight">MV Kids</span>
            </Link>

            {/* Nav */}
            <nav className="flex gap-0.5">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-[13.5px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                Today
              </Link>
              <Link
                href="/calendar"
                className="px-3 py-1.5 rounded-md text-[13.5px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                Week
              </Link>
              <Link
                href="/health"
                className="px-3 py-1.5 rounded-md text-[13.5px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 transition-colors"
              >
                Sources
              </Link>
            </nav>
          </header>

          {children}

          <footer className="mt-12 pt-4 border-t border-stone-200 text-xs text-stone-400 flex items-center justify-between">
            <span>Live data — refreshed hourly via cron.</span>
            <a href="/api/refresh" className="hover:text-stone-600 transition-colors">
              Refresh now →
            </a>
          </footer>
        </div>
      </body>
    </html>
  );
}
