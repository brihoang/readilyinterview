"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  PartyPopper,
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
}: Props) {
  const [showRerunModal, setShowRerunModal] = useState(false);
  const [allMarkedDismissed, setAllMarkedDismissed] = useState(false);

  const markedQuestions = questions.filter(
    (q) => liveResults[q.id]?.markedCompliant,
  );

  return (
    <>
      {/* Results summary bar */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-xl border mb-6">
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4" /> {passCount} compliant
          </span>
          <span className="flex items-center gap-1.5 text-red-700 font-medium">
            <XCircle className="h-4 w-4" /> {failCount} need attention
          </span>
        </div>
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRerunModal(true)}
          >
            <RotateCcw className="h-4 w-4" />
            Re-run Audit
          </Button>
        </div>
      </div>

      {/* Non-compliant questions (todo list) */}
      {failCount > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            Needs Attention ({failCount})
          </h3>
          <div className="space-y-3">
            {questions
              .filter((q) => {
                const r = liveResults[q.id];
                return r && r.verdict !== "pass" && !r.markedCompliant;
              })
              .map((q) => (
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
                  <span className="text-xs text-emerald-600">
                    Marked compliant by {r.markedCompliantBy} ·{" "}
                    {r.markedCompliantAt
                      ? new Date(r.markedCompliantAt).toLocaleDateString()
                      : ""}
                  </span>
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
                  All questions compliant!
                </DialogTitle>
                <DialogDescription className="text-center">
                  Your policies satisfy all {questions.length} questionnaire
                  requirements.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="justify-center">
                <Button onClick={onResultsModalClose}>View Full Report</Button>
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

      {/* All-marked modal */}
      {allMarked && !showRerunModal && (
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
    </>
  );
}
