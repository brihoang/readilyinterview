"use client";

import { ExternalLink, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GapList } from "./GapList";
import type { FederalDocument, PolicyRecommendation } from "@/lib/store/types";

const typeLabel: Record<string, string> = {
  PRULE: "Proposed Rule",
  RULE: "Final Rule",
  NOTICE: "Notice",
};

const impactClass: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

interface RegulationCardProps {
  doc: FederalDocument;
  recommendation?: PolicyRecommendation;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function RegulationCard({
  doc,
  recommendation,
  onAnalyze,
  isAnalyzing,
}: RegulationCardProps) {
  const typeStr = typeLabel[doc.type] ?? doc.type;
  const inProgress =
    isAnalyzing || doc.analysisStatus === "analyzing";

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-600 border-slate-200">
                {typeStr}
              </span>
              {recommendation && (
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${impactClass[recommendation.impactLevel]}`}
                >
                  {recommendation.impactLevel.charAt(0).toUpperCase() +
                    recommendation.impactLevel.slice(1)}{" "}
                  Impact
                </span>
              )}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 leading-snug line-clamp-2">
              {doc.title}
            </h3>
          </div>
          <a
            href={doc.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            title="View on Federal Register"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        {/* Meta */}
        <p className="text-xs text-muted-foreground">
          {doc.agencies.join(", ")}
          <span className="mx-1.5 text-slate-300">·</span>
          Published {doc.publicationDate}
        </p>

        {/* Body */}
        {!recommendation && !inProgress && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAnalyze}
            disabled={doc.analysisStatus === "error"}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {doc.analysisStatus === "error" ? "Analysis failed" : "Analyze Gaps"}
          </Button>
        )}

        {inProgress && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing regulation…
          </div>
        )}

        {recommendation && !inProgress && (
          <GapList
            recommendation={recommendation}
            regulationId={doc.id}
            regulationTitle={doc.title}
          />
        )}
      </CardContent>
    </Card>
  );
}
