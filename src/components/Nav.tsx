"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Compass, ListChecks } from "lucide-react";

const TABS = [
  { href: "/", label: "Brand Advisor", icon: Building2 },
  { href: "/bridge", label: "Taste Bridge", icon: Compass },
  { href: "/eval", label: "Evaluation", icon: ListChecks },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" className="flex items-baseline gap-2">
          <span className="text-lg font-semibold tracking-tight">TasteBridge</span>
          <span className="text-xs text-stone-500">Taiwan → Japan, powered by Qloo</span>
        </Link>
        <nav className="flex gap-1 overflow-x-auto">
          {TABS.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link key={href} href={href} className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[13px] sm:gap-1.5 sm:px-3 sm:text-sm ${active ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"}`}>
                <Icon className="size-4" aria-hidden />{label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
