"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/calendar", label: "Week" },
  { href: "/health", label: "Sources" },
];

export function SiteNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-0.5">
      {NAV.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`px-3 py-1.5 rounded-md text-[13.5px] font-medium transition-colors ${
            path === href
              ? "bg-stone-900 text-white"
              : "text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
