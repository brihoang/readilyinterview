"use client";

import { useState, useRef } from "react";
import { Mail, Slack } from "lucide-react";
import { getDemoUser } from "@/lib/users";

interface Props {
  name: string;
  className?: string;
}

export function UserHoverCard({ name, className }: Props) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const user = getDemoUser(name);

  function handleMouseEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  }

  function handleMouseLeave() {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  if (!user) return <span className={className}>{name}</span>;

  return (
    <span className="relative inline-block">
      <span
        className={`cursor-pointer underline decoration-dotted underline-offset-2 ${className ?? ""}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {name}
      </span>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border bg-white shadow-lg p-3"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className={`h-9 w-9 rounded-full ${user.color} flex items-center justify-center shrink-0`}
            >
              <span className="text-xs font-semibold text-white">
                {user.initials}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800 leading-none">
                {user.displayName}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user.title}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={`mailto:${user.email}`}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-accent transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-accent transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                alert(`Opening Slack conversation with ${user.displayName}…`);
              }}
            >
              <Slack className="h-3.5 w-3.5" />
              Slack
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
