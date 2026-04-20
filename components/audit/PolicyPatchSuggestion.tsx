"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, ChevronDown, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/context/UserContext";
import type { PolicyPatch } from "@/lib/store/types";

interface Props {
  auditId: string;
  questionId: string;
  onMarkCompliant?: (v: boolean) => void;
}

export function PolicyPatchSuggestion({ auditId, questionId, onMarkCompliant }: Props) {
  const { currentUser } = useCurrentUser();
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patch, setPatch] = useState<PolicyPatch | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState<{ by: string; at: string } | null>(null);

  async function fetchPatch() {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/audits/${auditId}/patch-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (res.status === 429) {
        throw new Error("Rate limit reached — wait a moment and try again.");
      }
      if (res.status === 404) {
        throw new Error("Audit result not found. Try re-running the audit.");
      }
      if (!res.ok) {
        throw new Error(`Something went wrong (${res.status}). Try again.`);
      }
      const data: PolicyPatch = await res.json();
      setPatch(data);
      setStatus("loaded");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  async function handleAccept() {
    if (!patch) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/audits/${auditId}/accept-patch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          originalText: patch.originalText,
          patchedText: patch.patchedText,
          reasoning: patch.reasoning,
          acceptedBy: currentUser.displayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to accept patch");
      setAccepted({ by: currentUser.displayName, at: new Date().toISOString() });
      onMarkCompliant?.(true);
    } catch {
      // leave accepting=false, let user retry
    } finally {
      setAccepting(false);
    }
  }

  async function handleToggle() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (status === "idle") fetchPatch();
  }

  return (
    <div className="mt-3 rounded-lg border border-indigo-100 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 bg-indigo-50/60 hover:bg-indigo-50 text-left transition-colors"
        onClick={handleToggle}
      >
        <Sparkles className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
        <span className="text-xs font-medium text-indigo-700 flex-1">
          Suggested Policy Update
        </span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-indigo-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-indigo-400" />
        )}
      </button>

      {expanded && (
        <div className="p-3 bg-white">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Drafting policy update…
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-sm text-slate-600">{errorMsg}</p>
              <button
                className="text-xs text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                onClick={fetchPatch}
              >
                Try again
              </button>
            </div>
          )}

          {status === "loaded" && patch && (
            <div className="space-y-3">
              {patch.originalText ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    Current Policy
                  </p>
                  <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3 text-sm text-slate-600 italic leading-relaxed">
                    &ldquo;{patch.originalText}&rdquo;
                  </div>
                </div>
              ) : (
                <div className="rounded-md bg-neutral-50 border border-neutral-200 p-3 text-sm text-slate-500 italic">
                  No existing policy covers this requirement.
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  Suggested Update
                </p>
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-slate-700 leading-relaxed">
                  {patch.patchedText}
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                {patch.reasoning}
              </p>

              {accepted ? (
                <div className="flex items-center gap-2 pt-1 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Patch accepted by {accepted.by} ·{" "}
                  {new Date(accepted.at).toLocaleDateString()}
                </div>
              ) : (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAccept}
                    disabled={accepting}
                  >
                    {accepting && <Loader2 className="h-3 w-3 animate-spin" />}
                    Patch & Mark Compliant
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Applies to policy library immediately
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
