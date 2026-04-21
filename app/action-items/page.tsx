"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, CheckSquare, Square, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/lib/context/UserContext";
import { DEMO_USERS } from "@/lib/users";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/store/types";

type Filter = "mine" | "all" | "open" | "completed";

export default function ActionItemsPage() {
  const { currentUser } = useCurrentUser();
  const router = useRouter();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("mine");
  const [showDialog, setShowDialog] = useState(false);
  const [text, setText] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUser.displayName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/action-items")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch("/api/action-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim(), createdBy: currentUser.displayName, assignedTo }),
    });
    const data = await res.json();
    setItems((prev) => [data.item, ...prev]);
    setText("");
    setAssignedTo(currentUser.displayName);
    setShowDialog(false);
    setSaving(false);
  }

  async function handleComplete(item: ActionItem) {
    const res = await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        completedAt: new Date().toISOString(),
        completedBy: currentUser.displayName,
      }),
    });
    const data = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
  }

  async function handleReopen(item: ActionItem) {
    const res = await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", completedAt: undefined, completedBy: undefined }),
    });
    const data = await res.json();
    setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/action-items/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const filtered = items.filter((i) => {
    if (filter === "mine") return i.assignedTo === currentUser.displayName && i.status === "open";
    if (filter === "all") return true;
    return i.status === filter;
  });

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Action Items</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Operational tasks that go beyond policy updates.
          </p>
        </div>
        <Button onClick={() => setShowDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Action Item
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {([
          { key: "mine", label: "My Action Items", count: items.filter((i) => i.assignedTo === currentUser.displayName && i.status === "open").length },
          { key: "open", label: "Open", count: items.filter((i) => i.status === "open").length },
          { key: "completed", label: "Completed", count: items.filter((i) => i.status === "completed").length },
          { key: "all", label: "All", count: items.length },
        ] as { key: Filter; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              filter === key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            <span className="ml-1.5 text-xs">({count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <CheckSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-slate-600 font-medium">
            {filter === "mine" ? "No open items assigned to you" : `No ${filter !== "all" ? filter : ""} action items`}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "mine" || filter === "open" ? "All caught up!" : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => {
            const done = item.status === "completed";
            const user = DEMO_USERS.find((u) => u.displayName === item.assignedTo);
            return (
              <div
                key={item.id}
                className={cn("flex items-start gap-3 rounded-lg border bg-white p-3.5", done && "opacity-60")}
              >
                <button
                  onClick={done ? () => handleReopen(item) : () => handleComplete(item)}
                  className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                  title={done ? "Mark open" : "Mark complete"}
                >
                  {done
                    ? <CheckSquare className="h-4 w-4 text-emerald-600" />
                    : <Square className="h-4 w-4" />
                  }
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm text-slate-800", done && "line-through text-muted-foreground")}>
                    {item.text}
                  </p>
                  <div className="flex items-center flex-wrap gap-2 mt-1.5">
                    {user && (
                      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white", user.color)}>
                        {user.initials}
                        <span className="font-normal opacity-90">{user.displayName}</span>
                      </span>
                    )}
                    {item.auditId && item.auditName && (
                      <button
                        onClick={() => router.push(`/audits/${item.auditId}`)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {item.auditName}
                      </button>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {done && item.completedAt
                        ? `Completed ${new Date(item.completedAt).toLocaleDateString()}`
                        : `Added ${new Date(item.createdAt).toLocaleDateString()}`
                      }
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="shrink-0 text-muted-foreground/50 hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Action Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Textarea
              placeholder="Describe the action required…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              autoFocus
            />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">Assign to</label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {DEMO_USERS.map((u) => (
                  <option key={u.id} value={u.displayName}>{u.displayName} — {u.title}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!text.trim() || saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
