"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Question, QuestionResult, Verdict } from "@/lib/store/types";

const verdictConfig: Record<
  Verdict,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  pass: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-100",
    label: "Compliant",
  },
  fail: {
    icon: <XCircle className="h-4 w-4 text-red-500" />,
    color: "text-red-700",
    bg: "bg-red-50 border-red-100",
    label: "Non-Compliant",
  },
  partial: {
    icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-100",
    label: "Partial",
  },
  pending: {
    icon: (
      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
    ),
    color: "text-muted-foreground",
    bg: "bg-white",
    label: "Pending",
  },
};

export function EvaluationRow({
  question,
  result,
  isEvaluating,
  showMarkCompliant,
  onMarkCompliant,
}: {
  question: Question;
  result?: QuestionResult;
  isEvaluating: boolean;
  showMarkCompliant?: boolean;
  onMarkCompliant?: (v: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const verdict = result?.verdict ?? "pending";
  const cfg = verdictConfig[verdict];

  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        result ? cfg.bg : "bg-white border-border",
      )}
    >
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => result && setExpanded(!expanded)}
      >
        <div className="shrink-0 mt-0.5">
          {isEvaluating && !result ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            cfg.icon
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className="text-xs shrink-0">
              {question.category}
            </Badge>
            {result && (
              <span className={cn("text-xs font-medium", cfg.color)}>
                {cfg.label}
              </span>
            )}
            {result && typeof result.confidence === "number" && (
              <span className="text-xs text-muted-foreground ml-auto">
                {Math.round(result.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <p className="text-sm text-slate-700">{question.text}</p>
        </div>
        {result && (
          <div className="flex items-center gap-2 shrink-0">
            {showMarkCompliant && onMarkCompliant && (
              <label
                className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className="rounded"
                  checked={result.markedCompliant ?? false}
                  onChange={(e) => onMarkCompliant(e.target.checked)}
                />
                Mark compliant
              </label>
            )}
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {expanded && result && (
        <>
          <Separator />
          <div className="p-4 space-y-3 text-sm">
            {result.evidenceText && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {result.verdict === "pass"
                    ? "Supporting Policy Language"
                    : "Related Policy Found"}
                </p>
                <blockquote className="border-l-2 border-primary pl-3 text-slate-700 italic text-sm leading-relaxed">
                  &ldquo;{result.evidenceText}&rdquo;
                </blockquote>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {result.sourceDocumentTitle}
                  {result.sourceSectionTitle
                    ? ` — ${result.sourceSectionTitle}`
                    : ""}
                </p>
              </div>
            )}
            {!result.evidenceText && result.verdict === "fail" && (
              <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-lg p-3">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>No matching policy found in the library.</p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Reasoning
              </p>
              <p className="text-slate-600">{result.reasoning}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
