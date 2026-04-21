"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/context/UserContext";
import { DEMO_USERS } from "@/lib/users";
import { cn } from "@/lib/utils";
import type { ActionItem } from "@/lib/store/types";

interface Props {
  auditId: string;
  auditName: string;
}

export function ActionItemsTab({ auditId, auditName }: Props) {
  const { currentUser } = useCurrentUser();
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUser.displayName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/action-items?auditId=${auditId}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [auditId]);

  async function handleCreate() {
    if (!text.trim()) return;
    setSaving(true);
    const res = await fetch("/api/action-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auditId, auditName, text: text.trim(), createdBy: currentUser.displayName, assignedTo }),
    });
    const data = await res.json();
    setItems((prev) => [data.item, ...prev]);
    setText("");
    setAssignedTo(currentUser.displayName);
    setShowForm(false);
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

  const open = items.filter((i) => i.status === "open");
  const completed = items.filter((i) => i.status === "completed");

  if (loading) {
    return <div className="py-8 space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Track operational work required beyond policy updates.
        </p>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Action Item
          </Button>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <Textarea
            placeholder="Describe the action required…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
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
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setText(""); }}>Cancel</Button>
            <Button size="sm" onClick={handleCreate} disabled={!text.trim() || saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      )}

      {open.length === 0 && completed.length === 0 && !showForm && (
        <div className="py-12 text-center">
          <CheckSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-slate-600 font-medium">No action items yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add one to track work outside of policy updates.</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="space-y-2">
          {open.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              onComplete={() => handleComplete(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pt-2">Completed</p>
          {completed.map((item) => (
            <ActionItemRow
              key={item.id}
              item={item}
              onReopen={() => handleReopen(item)}
              onDelete={() => handleDelete(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActionItemRow({
  item,
  onComplete,
  onReopen,
  onDelete,
}: {
  item: ActionItem;
  onComplete?: () => void;
  onReopen?: () => void;
  onDelete: () => void;
}) {
  const done = item.status === "completed";
  const user = DEMO_USERS.find((u) => u.displayName === item.assignedTo);

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border bg-white p-3", done && "opacity-60")}>
      <button
        onClick={done ? onReopen : onComplete}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
        title={done ? "Mark open" : "Mark complete"}
      >
        {done ? <CheckSquare className="h-4 w-4 text-emerald-600" /> : <Square className="h-4 w-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm text-slate-800", done && "line-through text-muted-foreground")}>{item.text}</p>
        <div className="flex items-center gap-2 mt-1">
          {user && (
            <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white", user.color)}>
              {user.initials}
              <span className="font-normal opacity-90">{user.displayName}</span>
            </span>
          )}
          {done && item.completedAt && (
            <span className="text-xs text-muted-foreground">
              Completed {new Date(item.completedAt).toLocaleDateString()}
            </span>
          )}
          {!done && (
            <span className="text-xs text-muted-foreground">
              Added {new Date(item.createdAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="shrink-0 text-muted-foreground/50 hover:text-red-500 transition-colors"
        title="Delete"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
