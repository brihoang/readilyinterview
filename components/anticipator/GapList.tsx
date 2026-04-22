"use client";

import { useState } from "react";
import { Sparkles, Loader2, AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { GapPatchPanel } from "./GapPatchPanel";
import { CreateActionItemDialog } from "@/components/shared/CreateActionItemDialog";
import type { PolicyRecommendation, PolicyGap, GapSeverity } from "@/lib/store/types";

const severityLabel: Record<GapSeverity, string> = {
  critical: "Critical",
  moderate: "Moderate",
  low: "Low",
};

const severityClass: Record<GapSeverity, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  moderate: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

const coverageDot: Record<string, string> = {
  none: "bg-red-500",
  partial: "bg-amber-400",
  adequate: "bg-green-500",
};

const coverageLabel: Record<string, string> = {
  none: "Not covered",
  partial: "Partially covered",
  adequate: "Already covered",
};

interface PatchData {
  improvedText: string;
  changesSummary: string;
  originalText: string;
  docId: string;
  sectionTitle: string;
}

interface GapRowProps {
  gap: PolicyGap;
  index: number;
  regulationId: string;
  regulationTitle: string;
}

function GapRow({ gap, index, regulationId, regulationTitle }: GapRowProps) {
  const canPatch = gap.currentCoverage === "partial" && gap.relevantPolicyTitle;

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [patch, setPatch] = useState<PatchData | null>(null);
  const [actionItemOpen, setActionItemOpen] = useState(false);

  const actionItemPrefill = `[${regulationTitle}] ${gap.requirement}: ${gap.suggestedAction}`;

  async function handleConfirmPatch() {
    setConfirmOpen(false);
    setFetchStatus("loading");
    try {
      const res = await fetch(`/api/anticipator/${regulationId}/gap-fix`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement: gap.requirement,
          suggestedAction: gap.suggestedAction,
          relevantPolicyTitle: gap.relevantPolicyTitle,
          relevantPolicySection: gap.relevantPolicySection,
        }),
      });
      if (!res.ok) throw new Error("fix failed");
      const data = await res.json();
      setPatch(data);
      setFetchStatus("done");
    } catch {
      setFetchStatus("error");
    }
  }

  return (
    <div className="rounded-lg border bg-slate-50 p-3 space-y-2">
      <div className="flex items-start gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${severityClass[gap.severity]}`}
        >
          {severityLabel[gap.severity]}
        </span>
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${coverageDot[gap.currentCoverage]}`} />
          <span className="text-[11px] text-muted-foreground">
            {coverageLabel[gap.currentCoverage]}
          </span>
        </div>
      </div>

      <p className="text-sm font-medium text-slate-800">{gap.requirement}</p>

      {gap.relevantPolicyTitle && (
        <blockquote className="border-l-2 border-slate-300 pl-2 text-xs text-muted-foreground">
          {gap.relevantPolicyTitle}
          {gap.relevantPolicySection && (
            <span className="text-slate-400"> — {gap.relevantPolicySection}</span>
          )}
        </blockquote>
      )}

      <div className="rounded bg-blue-50 border border-blue-100 px-2.5 py-1.5">
        <p className="text-xs text-blue-800">
          <span className="font-semibold">Suggested action: </span>
          {gap.suggestedAction}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => setActionItemOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Action Item
        </Button>
        {canPatch && fetchStatus === "idle" && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            onClick={() => setConfirmOpen(true)}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Draft Patch
          </Button>
        )}
      </div>

      {canPatch && fetchStatus === "loading" && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Drafting patch…
        </div>
      )}

      {fetchStatus === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-600">Failed to generate patch.</p>
          <button
            className="text-xs text-indigo-600 underline underline-offset-2"
            onClick={() => setFetchStatus("idle")}
          >
            Try again
          </button>
        </div>
      )}

      {fetchStatus === "done" && patch && (
        <GapPatchPanel patch={patch} regulationTitle={regulationTitle} />
      )}

      <CreateActionItemDialog
        open={actionItemOpen}
        onOpenChange={setActionItemOpen}
        prefillText={actionItemPrefill}
      />

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Draft Patch from Proposed Regulation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-slate-700">
            <p className="font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              This is not yet official regulation.
            </p>
            <p>
              This will generate a policy patch based on a proposed or recently finalized rule.
              The requirement may change before it takes effect, or may not apply to your organization.
            </p>
            <p className="text-muted-foreground">
              Review any generated patch carefully before applying it to the policy library.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPatch}>
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              Generate Patch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface GapListProps {
  recommendation: PolicyRecommendation;
  regulationId: string;
  regulationTitle: string;
}

export function GapList({ recommendation, regulationId, regulationTitle }: GapListProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {recommendation.summary}
      </p>

      {recommendation.effectiveDate && (
        <p className="text-xs text-muted-foreground">
          Expected effective:{" "}
          <span className="font-medium text-slate-700">{recommendation.effectiveDate}</span>
        </p>
      )}

      <div className="space-y-3">
        {recommendation.gaps.map((gap, i) => (
          <GapRow
            key={i}
            gap={gap}
            index={i}
            regulationId={regulationId}
            regulationTitle={regulationTitle}
          />
        ))}
      </div>
    </div>
  );
}
