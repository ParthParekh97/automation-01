"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/pipeline", label: "Pipeline", icon: "⬡" },
  { href: "/leads", label: "Leads", icon: "👤" },
  { href: "/calls", label: "Calls", icon: "📞" },
  { href: "/emails", label: "Emails", icon: "✉️" },
  { href: "/conversations", label: "Conversations", icon: "💬" },
  { href: "/bookings", label: "Bookings", icon: "📅" },
  { href: "/clients", label: "Clients", icon: "🏢" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 w-60 flex flex-col glass-card-sm rounded-none border-r border-white/[0.07] z-40">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-500/30 flex items-center justify-center text-base">
            ⚡
          </div>
          <span className="font-bold text-white tracking-tight">AI CRM</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-link", isActive && "active")}
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User area */}
      <div className="px-3 py-4 border-t border-white/[0.07]">
        <form action="/api/auth/signout" method="POST">
          <button type="submit" className="sidebar-link w-full justify-start">
            <span className="text-base w-5 text-center">🚪</span>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
