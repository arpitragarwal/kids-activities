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
        <div className="max-w-3xl mx-auto p-6">
          <header className="flex items-baseline justify-between border-b border-stone-200 pb-3 mb-6">
            <Link href="/" className="text-xl font-semibold tracking-tight">
              MV Kids
            </Link>
            <nav className="flex gap-4 text-sm text-stone-600">
              <Link href="/" className="hover:text-black">Today</Link>
              <Link href="/calendar" className="hover:text-black">Week</Link>
              <Link href="/health" className="hover:text-black">Sources</Link>
            </nav>
          </header>
          {children}
          <footer className="mt-12 pt-4 border-t border-stone-200 text-xs text-stone-400">
            Live data — refreshed hourly via cron.
          </footer>
        </div>
      </body>
    </html>
  );
}
