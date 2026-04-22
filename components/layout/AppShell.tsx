"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { UserSwitcher } from "./UserSwitcher";
import { UserProvider } from "@/lib/context/UserContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    await fetch("/api/admin/reset", { method: "POST" });
    setResetting(false);
    setShowResetDialog(false);
    router.push("/audits");
    router.refresh();
  }

  return (
    <UserProvider>
    <div className="flex h-screen overflow-hidden bg-slate-50 print:block print:h-auto print:overflow-visible">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden print:block print:overflow-visible">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-end gap-3 border-b bg-white px-6 shrink-0 print:hidden">
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setShowResetDialog(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear Demo Data
          </Button>
          <UserSwitcher />
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 print:overflow-visible">{children}</main>
      </div>

      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Clear all demo data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all audits and results. Policy
              documents are unaffected. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReset}
              disabled={resetting}
            >
              {resetting ? "Clearing…" : "Clear Data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </UserProvider>
  );
}
