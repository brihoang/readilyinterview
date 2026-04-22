"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/context/UserContext";
import { DEMO_USERS } from "@/lib/users";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillText?: string;
}

export function CreateActionItemDialog({ open, onOpenChange, prefillText = "" }: Props) {
  const { currentUser } = useCurrentUser();
  const [text, setText] = useState(prefillText);
  const [assignedTo, setAssignedTo] = useState(currentUser.displayName);
  const [saving, setSaving] = useState(false);

  function handleOpenChange(val: boolean) {
    if (val) setText(prefillText);
    onOpenChange(val);
  }

  async function handleCreate() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/action-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), createdBy: currentUser.displayName, assignedTo }),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast.success("Action item created.");
      onOpenChange(false);
      setText(prefillText);
      setAssignedTo(currentUser.displayName);
    } catch {
      toast.error("Failed to create action item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Action Item
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Textarea
            placeholder="Describe the action required…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            autoFocus
          />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 shrink-0">Assign to</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {DEMO_USERS.map((u) => (
                <option key={u.id} value={u.displayName}>{u.displayName} — {u.title}</option>
              ))}
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!text.trim() || saving}>
            {saving ? "Saving…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
