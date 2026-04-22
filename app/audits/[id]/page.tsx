"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building2, Calendar, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PrepWorkspace } from "@/components/audit/PrepWorkspace";
import { ActionItemsTab } from "@/components/audit/ActionItemsTab";
import type { Audit, ComplianceFramework } from "@/lib/store/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { UserHoverCard } from "@/components/ui/user-hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  {
    label: string;
    variant: "success" | "info" | "warning" | "secondary" | "error";
  }
> = {
  idle: { label: "Draft", variant: "secondary" },
  uploading: { label: "Uploading", variant: "info" },
  extracting: { label: "Extracting", variant: "info" },
  review: { label: "In Review", variant: "warning" },
  ready: { label: "Ready for AI Audit", variant: "info" },
  evaluating: { label: "Evaluating", variant: "warning" },
  complete: { label: "AI Verified", variant: "success" },
  complete_needs_review: { label: "Needs Review", variant: "warning" },
  archived: { label: "Signed Off", variant: "success" },
};

function getDisplayStatus(audit: Audit) {
  if (audit.status === "complete") {
    const results = Object.values(audit.results);
    const hasUnresolved = results.some(
      (r) => (r.verdict === "fail" || r.verdict === "partial") && !r.markedCompliant
    );
    if (hasUnresolved) return STATUS_CONFIG.complete_needs_review;
  }
  return STATUS_CONFIG[audit.status] ?? STATUS_CONFIG.idle;
}

export default function AuditDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function fetchAudit() {
    fetch(`/api/audits/${id}`)
      .then((r) => r.json())
      .then((d) => setAudit(d.audit ?? null))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/audits/${id}`, { method: "DELETE" });
    router.push("/audits");
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="h-32 rounded-xl border bg-white animate-pulse" />
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="max-w-5xl mx-auto text-center py-24">
        <p className="text-muted-foreground">Audit not found.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/audits")}
        >
          Back to Audits
        </Button>
      </div>
    );
  }

  const cfg = liveStatus
    ? (STATUS_CONFIG[liveStatus] ?? STATUS_CONFIG.idle)
    : getDisplayStatus(audit);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Back nav */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => router.push("/audits")}
      >
        <ArrowLeft className="h-4 w-4" />
        All Audits
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl font-bold text-slate-800">{audit.name}</h1>
            <Badge variant={cfg.variant}>{cfg.label}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {audit.organization}
            </span>
            {audit.targetDate && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {new Date(audit.targetDate).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
            <Badge variant="outline" className="text-xs">
              {audit.framework}
            </Badge>
            {audit.iterationCount > 0 && (
              <span className="flex items-center gap-1 text-xs">
                <RotateCcw className="h-3 w-3" />
                Run {audit.iterationCount}
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="prep">
        <TabsList className="mb-6">
          <TabsTrigger value="prep">Prep</TabsTrigger>
          <TabsTrigger value="actions">Action Items</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="prep">
          <PrepWorkspace
            audit={audit}
            onAuditChange={() => { setLiveStatus(null); fetchAudit(); }}
            onLiveStatusChange={setLiveStatus}
          />
        </TabsContent>

        <TabsContent value="actions">
          <ActionItemsTab auditId={audit.id} auditName={audit.name} />
        </TabsContent>

        <TabsContent value="details">
          <DetailsTab audit={audit} onSave={fetchAudit} />
        </TabsContent>
      </Tabs>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete audit?</DialogTitle>
            <DialogDescription>
              {audit.questions.length > 0 ? (
                <>
                  <span className="block mb-2">
                    This audit has{" "}
                    <strong>{audit.questions.length} question{audit.questions.length !== 1 ? "s" : ""}</strong>
                    {Object.keys(audit.results).length > 0
                      ? ` and ${Object.keys(audit.results).length} AI evaluation result${Object.keys(audit.results).length !== 1 ? "s" : ""}`
                      : ""}{" "}
                    that will be permanently lost.
                  </span>
                  This cannot be undone.
                </>
              ) : (
                "This will permanently delete the audit. This cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete Audit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailsTab({ audit, onSave }: { audit: Audit; onSave: () => void }) {
  const [form, setForm] = useState({
    name: audit.name,
    organization: audit.organization,
    framework: audit.framework,
    targetDate: audit.targetDate,
    notes: audit.notes,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch(`/api/audits/${audit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSave();
  }

  return (
    <div className="max-w-lg space-y-4">
      {(audit.createdBy || (audit.stakeholders && audit.stakeholders.length > 0)) && (
        <div className="flex flex-col gap-1.5 text-sm text-muted-foreground pb-3 border-b">
          {audit.createdBy && (
            <div className="flex items-center gap-2">
              <span>Created by</span>
              <UserHoverCard name={audit.createdBy} />
              <span>·</span>
              <span>{new Date(audit.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
            </div>
          )}
          {audit.stakeholders && audit.stakeholders.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span>Stakeholders</span>
              {audit.stakeholders.map((name) => (
                <UserHoverCard key={name} name={name} />
              ))}
            </div>
          )}
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Audit Name</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Organization</Label>
        <Input
          value={form.organization}
          onChange={(e) =>
            setForm((f) => ({ ...f, organization: e.target.value }))
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label>Compliance Framework</Label>
        <Select
          value={form.framework}
          onValueChange={(v) =>
            setForm((f) => ({ ...f, framework: v as ComplianceFramework }))
          }
        >
          <SelectTrigger>
            <SelectValue />
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
          rows={4}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
        />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Changes"}
      </Button>
    </div>
  );
}
