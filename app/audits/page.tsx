"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  ClipboardList,
  Building2,
  Calendar,
  ArrowRight,
  ShieldCheck,
  Archive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserHoverCard } from "@/components/ui/user-hover-card";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/lib/context/UserContext";
import { DEMO_USERS } from "@/lib/users";
import type { AuditSummary, ComplianceFramework } from "@/lib/store/types";

const FRAMEWORKS: ComplianceFramework[] = [
  "HIPAA",
  "CMS Conditions of Participation",
  "Joint Commission",
  "NCQA",
  "State Health Department",
  "Other",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "success" | "info" | "warning" | "secondary" }
> = {
  idle: { label: "Draft", variant: "secondary" },
  uploading: { label: "Uploading", variant: "info" },
  extracting: { label: "Extracting", variant: "info" },
  review: { label: "Review", variant: "warning" },
  ready: { label: "Ready for AI Audit", variant: "info" },
  evaluating: { label: "Evaluating", variant: "warning" },
  complete: { label: "AI Verified", variant: "success" },
  archived: { label: "Signed Off", variant: "success" },
  needs_review: { label: "Needs Review", variant: "warning" },
};

function getDisplayStatus(audit: AuditSummary) {
  if (audit.status === "complete") {
    const totalFailing = audit.failCount + audit.partialCount;
    const unresolved = totalFailing - (audit.markedCompliantCount ?? 0);
    if (unresolved > 0) return STATUS_CONFIG.needs_review;
  }
  return STATUS_CONFIG[audit.status] ?? STATUS_CONFIG.idle;
}

export default function AuditsPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  type SortKey = "due-asc" | "due-desc" | "date-desc" | "date-asc" | "score-desc" | "score-asc";
  const [sortKey, setSortKey] = useState<SortKey>("due-asc");
  const [form, setForm] = useState({
    name: "",
    organization: "",
    framework: "" as ComplianceFramework | "",
    targetDate: "",
    notes: "",
  });
  const [stakeholders, setStakeholders] = useState<string[]>([]);
  const [stakeholderSearch, setStakeholderSearch] = useState("");
  const [stakeholderOpen, setStakeholderOpen] = useState(false);

  useEffect(() => {
    fetch("/api/audits")
      .then((r) => r.json())
      .then((d) => setAudits(d.audits ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!form.name || !form.organization || !form.framework) return;
    setCreating(true);
    try {
      const res = await fetch("/api/audits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, createdBy: currentUser.displayName, stakeholders }),
      });
      const data = await res.json();
      router.push(`/audits/${data.audit.id}`);
    } finally {
      setCreating(false);
    }
  }

  function getUrgency(a: AuditSummary): "critical" | "warning" | null {
    if (!a.targetDate || a.status === "archived") return null;
    const msLeft = new Date(a.targetDate).getTime() - Date.now();
    if (msLeft <= 0) return "critical";
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);
    if (daysLeft <= 1) return "critical";
    if (daysLeft <= 7) return "warning";
    return null;
  }

  function getComplianceScore(a: AuditSummary) {
    if (a.questionCount === 0) return null;

    if (a.status === "archived") return 100; // archived audits are considered fully compliant
    return Math.round(
      ((a.passCount + (a.markedCompliantCount ?? 0)) / a.questionCount) * 100,
    );
  }

  const archivedCount = audits.filter((a) => a.status === "archived").length;

  const visibleAudits = audits
    .filter((a) => showArchived || a.status !== "archived")
    .sort((a, b) => {
      const noDate = 8640000000000000; // far future — audits with no date sort last
      switch (sortKey) {
        case "due-asc":
          return (a.targetDate ? new Date(a.targetDate).getTime() : noDate)
            - (b.targetDate ? new Date(b.targetDate).getTime() : noDate);
        case "due-desc":
          return (b.targetDate ? new Date(b.targetDate).getTime() : -noDate)
            - (a.targetDate ? new Date(a.targetDate).getTime() : -noDate);
        case "date-asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "score-asc":
          return (getComplianceScore(a) ?? -1) - (getComplianceScore(b) ?? -1);
        case "score-desc":
          return (getComplianceScore(b) ?? -1) - (getComplianceScore(a) ?? -1);
      }
    });

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Audits</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track your compliance audit preparations
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New Audit
        </Button>
      </div>

      {/* Toolbar */}
      {!loading && audits.length > 0 && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due-asc">Due soonest</SelectItem>
              <SelectItem value="due-desc">Due latest</SelectItem>
              <SelectItem value="date-desc">Newest first</SelectItem>
              <SelectItem value="date-asc">Oldest first</SelectItem>
              <SelectItem value="score-desc">Highest score</SelectItem>
              <SelectItem value="score-asc">Lowest score</SelectItem>
            </SelectContent>
          </Select>
          {archivedCount > 0 && (
            <Button
              variant={showArchived ? "secondary" : "ghost"}
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="h-3.5 w-3.5" />
              {showArchived ? "Hide archived" : `Show archived (${archivedCount})`}
            </Button>
          )}
        </div>
      )}

      {/* Audit list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 rounded-xl border bg-white animate-pulse"
            />
          ))}
        </div>
      ) : audits.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h3 className="font-semibold text-slate-700 mb-1">No audits yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first audit to start preparing for compliance reviews
            </p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" />
              New Audit
            </Button>
          </CardContent>
        </Card>
      ) : visibleAudits.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          All audits are archived.{" "}
          <button
            className="underline underline-offset-2 hover:text-slate-700"
            onClick={() => setShowArchived(true)}
          >
            Show archived
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleAudits.map((audit) => {
            const cfg = getDisplayStatus(audit);
            const score = getComplianceScore(audit);
            const urgency = getUrgency(audit);
            return (
              <Card
                key={audit.id}
                className={cn(
                  "hover:shadow-md transition-shadow cursor-pointer border-l-4",
                  urgency === "critical"
                    ? "border-l-red-500 bg-red-50/40"
                    : urgency === "warning"
                      ? "border-l-amber-400 bg-amber-50/40"
                      : "border-l-transparent",
                )}
                onClick={() => router.push(`/audits/${audit.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {audit.name}
                      </h3>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {audit.archivedBy && (
                        <span className="flex items-center gap-1 text-xs text-emerald-700">
                          <ShieldCheck className="h-3 w-3" />
                          <UserHoverCard name={audit.archivedBy} />
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {audit.organization}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className={cn(
                          "h-3.5 w-3.5",
                          urgency === "critical" ? "text-red-500" : urgency === "warning" ? "text-amber-500" : "",
                        )} />
                        <span className={cn(
                          urgency === "critical" ? "text-red-600 font-medium" : urgency === "warning" ? "text-amber-600 font-medium" : "",
                        )}>
                          {audit.targetDate
                            ? new Date(audit.targetDate).toLocaleDateString()
                            : "No date set"}
                        </span>
                        {urgency === "critical" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            Due soon
                          </span>
                        )}
                        {urgency === "warning" && (
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            This week
                          </span>
                        )}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {audit.framework}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    {audit.questionCount > 0 && (
                      <div className="text-center">
                        {score !== null ? (
                          <TooltipProvider>
                            <div className="flex flex-col items-center">
                              <div className="flex items-start gap-0.5">
                                <p className="text-2xl font-bold text-slate-800">
                                  {score}%
                                </p>
                                {audit.status === "archived" &&
                                  audit.passCount !== audit.questionCount && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="text-amber-500 text-xs font-semibold mt-0.5 cursor-default">
                                          *
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent
                                        side="top"
                                        className="max-w-xs text-xs"
                                      >
                                        At least one question was manually
                                        marked compliant without AI verification
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Compliance
                              </p>
                            </div>
                          </TooltipProvider>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-slate-800">
                              {audit.questionCount}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Questions
                            </p>
                          </>
                        )}
                      </div>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Create New Audit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 px-1">
            <div className="space-y-1.5">
              <Label>Audit Name *</Label>
              <Input
                placeholder="e.g. Q2 2026 HIPAA Readiness Review"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Organization *</Label>
              <Input
                placeholder="e.g. Lakewood Regional Medical Center"
                value={form.organization}
                onChange={(e) =>
                  setForm((f) => ({ ...f, organization: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Compliance Framework *</Label>
              <Select
                value={form.framework}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    framework: v as ComplianceFramework,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select framework..." />
                </SelectTrigger>
                <SelectContent>
                  {FRAMEWORKS.map((fw) => (
                    <SelectItem key={fw} value={fw}>
                      {fw}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Target Audit Date</Label>
              <Input
                type="date"
                value={form.targetDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, targetDate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional context..."
                rows={3}
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stakeholders <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <div className="relative">
                <Input
                  placeholder="Search users…"
                  value={stakeholderSearch}
                  onChange={(e) => { setStakeholderSearch(e.target.value); setStakeholderOpen(true); }}
                  onFocus={() => setStakeholderOpen(true)}
                  onBlur={() => setTimeout(() => setStakeholderOpen(false), 150)}
                  autoComplete="off"
                />
                {stakeholderOpen && (() => {
                  const opts = DEMO_USERS.filter(
                    (u) =>
                      u.displayName !== currentUser.displayName &&
                      !stakeholders.includes(u.displayName) &&
                      u.displayName.toLowerCase().includes(stakeholderSearch.toLowerCase()),
                  );
                  return opts.length > 0 ? (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-md">
                      {opts.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-accent text-left"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setStakeholders((prev) => [...prev, u.displayName]);
                            setStakeholderSearch("");
                            setStakeholderOpen(false);
                          }}
                        >
                          <span className={cn("h-6 w-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0", u.color)}>
                            {u.initials}
                          </span>
                          <div>
                            <p className="font-medium text-slate-800">{u.displayName}</p>
                            <p className="text-xs text-muted-foreground">{u.title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
              {stakeholders.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {stakeholders.map((name) => {
                    const u = DEMO_USERS.find((u) => u.displayName === name);
                    return (
                      <span key={name} className="flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full bg-slate-100 border text-xs font-medium text-slate-700">
                        {u && (
                          <span className={cn("h-4 w-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0", u.color)}>
                            {u.initials}
                          </span>
                        )}
                        {name}
                        <button
                          type="button"
                          className="ml-0.5 text-muted-foreground hover:text-red-500"
                          onClick={() => setStakeholders((prev) => prev.filter((n) => n !== name))}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Stakeholders will see this audit in their Outstanding Tasks.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setStakeholders([]); setStakeholderSearch(""); setStakeholderOpen(false); }}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={
                creating || !form.name || !form.organization || !form.framework
              }
            >
              {creating ? "Creating..." : "Create Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
