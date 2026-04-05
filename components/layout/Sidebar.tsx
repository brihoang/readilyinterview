"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FolderOpen, ShieldCheck, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/audits", label: "Audits", icon: ClipboardList },
  { href: "/tasks", label: "Outstanding Tasks", icon: ListTodo },
  { href: "/policies", label: "Policy Library", icon: FolderOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-white flex flex-col">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b shrink-0">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <span className="font-bold text-lg tracking-tight text-slate-800">
          Readily
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t">
        <p className="text-[11px] text-muted-foreground">
          Readily Compliance Platform
        </p>
        <p className="text-[11px] text-muted-foreground">v1.0.0-demo</p>
      </div>
    </aside>
  );
}
