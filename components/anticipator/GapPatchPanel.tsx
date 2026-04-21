"use client";

import { useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentUser } from "@/lib/context/UserContext";

interface PatchData {
  improvedText: string;
  changesSummary: string;
  originalText: string;
  docId: string;
  sectionTitle: string;
}

interface GapPatchPanelProps {
  patch: PatchData;
  regulationTitle: string;
}

export function GapPatchPanel({ patch, regulationTitle }: GapPatchPanelProps) {
  const { currentUser } = useCurrentUser();
  const [editedText, setEditedText] = useState(patch.improvedText);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/gap-patch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docId: patch.docId,
          originalText: patch.originalText,
          patchedText: editedText,
          reasoning: `Proactive patch for upcoming regulation: ${regulationTitle}. ${patch.changesSummary}`,
          acceptedBy: currentUser.displayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to apply patch");
      setAccepted(currentUser.displayName);
    } catch {
      setError("Failed to apply patch — try again.");
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-indigo-100 bg-white overflow-hidden">
      <div className="px-3 py-2 bg-indigo-50/60 border-b border-indigo-100">
        <p className="text-xs font-medium text-indigo-700">Draft Policy Patch</p>
      </div>
      <div className="p-3 space-y-3">
        {patch.originalText ? (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Current Text
            </p>
            <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3 text-sm text-slate-600 italic leading-relaxed">
              &ldquo;{patch.originalText}&rdquo;
            </div>
          </div>
        ) : (
          <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3 text-sm text-slate-500 italic">
            No existing policy text — new language will be appended.
          </div>
        )}

        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Suggested Update
          </p>
          <Textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={6}
            className="text-sm font-mono bg-green-50 border-green-200 focus-visible:ring-green-300"
            disabled={!!accepted}
          />
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {patch.changesSummary}
        </p>

        {error && <p className="text-xs text-red-600">{error}</p>}

        {accepted ? (
          <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            Patch applied by {accepted}
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAccept}
              disabled={accepting || !editedText.trim()}
            >
              {accepting && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
              Apply Patch
            </Button>
            <span className="text-xs text-muted-foreground">
              Updates policy library immediately
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
