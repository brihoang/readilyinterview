"use client";

import { DEMO_USERS } from "@/lib/users";
import { useCurrentUser } from "@/lib/context/UserContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export function UserSwitcher() {
  const { currentUser, setCurrentUser } = useCurrentUser();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-3">
        {/* Avatar switcher */}
        <div className="flex items-center gap-1.5">
          {DEMO_USERS.map((user) => {
            const active = user.id === currentUser.id;
            return (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setCurrentUser(user)}
                    className={cn(
                      "h-8 w-8 rounded-full text-white text-xs font-semibold transition-all",
                      user.color,
                      active
                        ? "ring-2 ring-offset-2 ring-slate-400 opacity-100"
                        : "opacity-40 hover:opacity-70",
                    )}
                  >
                    {user.initials}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">{user.displayName}</p>
                  <p className="text-xs text-muted-foreground">{user.title}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Active user info */}
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="flex items-center justify-end gap-1.5">
              <p className="text-sm font-medium leading-none">
                {currentUser.displayName}
              </p>
              {currentUser.role === "admin" && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 h-4 border-rose-300 text-rose-600"
                >
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentUser.title}
            </p>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
