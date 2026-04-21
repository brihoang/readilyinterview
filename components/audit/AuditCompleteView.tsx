"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  PartyPopper,
  ShieldCheck,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EvaluationRow } from "./EvaluationRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { UserHoverCard } from "@/components/ui/user-hover-card";
import type { Question, QuestionResult } from "@/lib/store/types";

interface Props {
  auditId: string;
  questions: Question[];
  liveResults: Record<string, QuestionResult>;
  passCount: number;
  failCount: number;
  allPassed: boolean;
  allMarked: boolean;
  showResultsModal: boolean;
  onResultsModalClose: () => void;
  onMarkCompliant: (questionId: string, value: boolean) => void;
  onRerun: (mode: "all" | "failed-only") => void;
  onArchive?: () => void;
  isArchived?: boolean;
  archivedBy?: string;
  archivedAt?: string;
}

export function AuditCompleteView({
  auditId,
  questions,
  liveResults,
  passCount,
  failCount,
  allPassed,
  allMarked,
  showResultsModal,
  onResultsModalClose,
  onMarkCompliant,
  onRerun,
  onArchive,
  isArchived,
  archivedBy,
  archivedAt,
}: Props) {
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [allMarkedDismissed, setAllMarkedDismissed] = useState(false);
  const [showManualSignOffConfirm, setShowManualSignOffConfirm] = useState(false);

  const markedQuestions = questions.filter(
    (q) => liveResults[q.id]?.markedCompliant,
  );

  const needsAttentionQuestions = questions.filter((q) => {
    const r = liveResults[q.id];
    if (!r) return true;
    return r.verdict !== "pass" && !r.markedCompliant;
  });

  const totalExposure = questions.reduce(
    (acc, q) => {
      const r = liveResults[q.id];
      if (!r?.estimatedExposure || r.verdict === "pass") return acc;
      return {
        low: acc.low + r.estimatedExposure.low,
        high: acc.high + r.estimatedExposure.high,
      };
    },
    { low: 0, high: 0 },
  );

  function formatExposureRange({ low, high }: { low: number; high: number }) {
    const fmt = (n: number) =>
      n >= 1_000_000
        ? `$${(n / 1_000_000).toFixed(1)}M`
        : n >= 1_000
          ? `$${(n / 1_000).toFixed(0)}K`
          : `$${n.toLocaleString()}`;
    return `${fmt(low)} – ${fmt(high)}`;
  }

  return (
    <>
      {/* Results summary bar */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border mb-6">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {passCount} compliant
          </span>
          <span className="flex items-center gap-1.5 text-red-700 font-medium">
            <XCircle className="h-4 w-4" /> {needsAttentionQuestions.length} need attention
          </span>
          {totalExposure.high > 0 && (
            <span className="flex items-center gap-1.5 text-red-700 font-medium border-l pl-4">
              <DollarSign className="h-4 w-4" />
              {formatExposureRange(totalExposure)} estimated exposure
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isArchived ? (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Signed off by{" "}
              {archivedBy ? <UserHoverCard name={archivedBy} /> : null}
              {" "}·{" "}
              {archivedAt ? new Date(archivedAt).toLocaleDateString() : ""}
            </span>
          ) : (
            <>
              {onArchive && (allPassed || allMarked) && (
                <Button
                  size="sm"
                  onClick={allPassed ? onArchive : () => setShowManualSignOffConfirm(true)}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Sign Off Audit
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRerunModal(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Re-run Audit
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Non-compliant questions (todo list) */}
      {needsAttentionQuestions.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Needs Attention ({needsAttentionQuestions.length})
          </h3>
          <div className="space-y-3">
            {needsAttentionQuestions.map((q) => (
              <EvaluationRow
                key={q.id}
                question={q}
                result={liveResults[q.id]}
                isEvaluating={false}
                showMarkCompliant
                onMarkCompliant={(v) => onMarkCompliant(q.id, v)}
                auditId={auditId}
              />
            ))}
          </div>
        </div>
      )}

      {/* Marked compliant bucket */}
      {markedQuestions.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Marked Compliant ({markedQuestions.length})
          </h3>
          <div className="space-y-2">
            {markedQuestions.map((q) => {
              const r = liveResults[q.id];
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="flex-1 text-slate-700">{q.text}</span>
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    Marked compliant by{" "}
                    {r.markedCompliantBy ? (
                      <UserHoverCard name={r.markedCompliantBy} />
                    ) : null}
                    {" "}·{" "}
                    {r.markedCompliantAt
                      ? new Date(r.markedCompliantAt).toLocaleDateString()
                      : ""}
                  </span>
                  <button
                    className="text-xs text-muted-foreground hover:text-red-600 underline underline-offset-2 shrink-0"
                    onClick={() => onMarkCompliant(q.id, false)}
                  >
                    Unmark
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Compliant accordion */}
      <CollapsibleSection
        title={`Compliant Questions (${passCount})`}
        defaultOpen={allPassed}
        icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />}
      >
        <div className="space-y-2">
          {questions
            .filter((q) => liveResults[q.id]?.verdict === "pass")
            .map((q) => (
              <EvaluationRow
                key={q.id}
                question={q}
                result={liveResults[q.id]}
                isEvaluating={false}
              />
            ))}
        </div>
      </CollapsibleSection>

      {/* Results modal */}
      <Dialog open={showResultsModal} onOpenChange={onResultsModalClose}>
        <DialogContent className="sm:max-w-md text-center">
          {allPassed ? (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <PartyPopper className="h-12 w-12 text-amber-400" />
                </div>
                <DialogTitle className="text-center text-xl">
                  AI verification passed
                </DialogTitle>
                <DialogDescription className="text-center">
                  All {questions.length} questions cleared by the AI. A compliance
                  officer should review and sign off to officially close this audit.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {onArchive && (
                  <Button
                    className="w-full"
                    onClick={() => { onResultsModalClose(); onArchive(); }}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Sign Off &amp; Close Audit
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={onResultsModalClose}>
                  Review Report First
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex justify-center mb-2">
                  <AlertTriangle className="h-10 w-10 text-amber-500" />
                </div>
                <DialogTitle className="text-center">
                  {failCount} questions need attention
                </DialogTitle>
                <DialogDescription className="text-center">
                  {passCount} of {questions.length} questions passed. Review the
                  gaps below to update your policies before the audit.
                  {totalExposure.high > 0 && (
                    <span className="block mt-2 font-medium text-red-700">
                      Estimated exposure:{" "}
                      {formatExposureRange(totalExposure)}
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="justify-center">
                <Button onClick={onResultsModalClose}>Review Results</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Re-run modal */}
      <Dialog open={showRerunModal} onOpenChange={setShowRerunModal}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-run Audit</DialogTitle>
            <DialogDescription>
              Choose which questions to evaluate.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRerunModal(false);
                onRerun("failed-only");
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Run Failed Questions Only
            </Button>
            <Button
              onClick={() => {
                setShowRerunModal(false);
                onRerun("all");
              }}
            >
              Run Full Suite ({questions.length} questions)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* All-marked modal — only when marked compliant but not yet re-run */}
      {allMarked && !allPassed && !showRerunModal && (
        <Dialog
          open={!allMarkedDismissed}
          onOpenChange={(open) => !open && setAllMarkedDismissed(true)}
        >
          <DialogContent className="sm:max-w-sm text-center">
            <DialogHeader>
              <DialogTitle className="text-center">
                All questions addressed!
              </DialogTitle>
              <DialogDescription className="text-center">
                Ready to re-run the audit to verify your updates?
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Button
                onClick={() => {
                  setAllMarkedDismissed(true);
                  setShowRerunModal(true);
                }}
              >
                Re-run Audit
              </Button>
              <Button
                variant="ghost"
                onClick={() => setAllMarkedDismissed(true)}
              >
                Not yet
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {/* Manual sign-off confirmation */}
      <Dialog open={showManualSignOffConfirm} onOpenChange={setShowManualSignOffConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
            </div>
            <DialogTitle className="text-center">
              Not all questions were AI-verified
            </DialogTitle>
            <DialogDescription className="text-center">
              Some questions were marked compliant manually rather than verified
              by the AI. By signing off, you confirm that you have personally
              reviewed each unaudited question and attest to their compliance.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full"
              onClick={() => {
                setShowManualSignOffConfirm(false);
                onArchive?.();
              }}
            >
              <ShieldCheck className="h-4 w-4" />
              I confirm — Sign Off Audit
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowManualSignOffConfirm(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
