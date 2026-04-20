"use client";

import { useState } from "react";
import { Sparkles, ChevronRight, ChevronDown, Loader2 } from "lucide-react";
import type { PolicyPatch } from "@/lib/store/types";

interface Props {
  auditId: string;
  questionId: string;
}

export function PolicyPatchSuggestion({ auditId, questionId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    "idle",
  );
  const [patch, setPatch] = useState<PolicyPatch | null>(null);

  async function fetchPatch() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/audits/${auditId}/patch-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId }),
      });
      if (!res.ok) throw new Error("Failed to generate suggestion");
      const data: PolicyPatch = await res.json();
      setPatch(data);
      setStatus("loaded");
    } catch {
      setStatus("error");
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
              <p className="text-sm text-slate-600">
                Rate limit reached — wait a moment and try again.
              </p>
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
            </div>
          )}
        </div>
      )}
    </div>
  );
}
