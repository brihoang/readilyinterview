"use client";

import { Badge } from "@/components/ui/badge";
import type { PolicyRecommendation, GapSeverity } from "@/lib/store/types";

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

interface GapListProps {
  recommendation: PolicyRecommendation;
}

export function GapList({ recommendation }: GapListProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-relaxed">
        {recommendation.summary}
      </p>

      {recommendation.effectiveDate && (
        <p className="text-xs text-muted-foreground">
          Expected effective:{" "}
          <span className="font-medium text-slate-700">
            {recommendation.effectiveDate}
          </span>
        </p>
      )}

      <div className="space-y-3">
        {recommendation.gaps.map((gap, i) => (
          <div
            key={i}
            className="rounded-lg border bg-slate-50 p-3 space-y-2"
          >
            <div className="flex items-start gap-2 flex-wrap">
              <span
                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${severityClass[gap.severity]}`}
              >
                {severityLabel[gap.severity]}
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${coverageDot[gap.currentCoverage]}`}
                />
                <span className="text-[11px] text-muted-foreground">
                  {coverageLabel[gap.currentCoverage]}
                </span>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-800">
              {gap.requirement}
            </p>

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
          </div>
        ))}
      </div>
    </div>
  );
}
