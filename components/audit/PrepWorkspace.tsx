"use client";

import { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import type { Audit, Question, QuestionResult } from "@/lib/store/types";
import { UploadModal } from "./UploadModal";
import { RunAuditDialog } from "./RunAuditDialog";
import { QuestionReview } from "./QuestionReview";
import { EvaluationRow } from "./EvaluationRow";
import { AuditCompleteView } from "./AuditCompleteView";

interface Props {
  audit: Audit;
  onAuditChange: () => void;
}

type UIStatus =
  | "idle"
  | "uploading"
  | "extracting"
  | "review"
  | "ready"
  | "evaluating"
  | "complete";

export function PrepWorkspace({ audit, onAuditChange }: Props) {
  const [currentStatus, setCurrentStatus] = useState<UIStatus>(
    audit.status as UIStatus,
  );
  const [questions, setQuestions] = useState<Question[]>(audit.questions);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(0);
  const [liveResults, setLiveResults] = useState<Record<string, QuestionResult>>(
    audit.results ?? {},
  );
  const abortRef = useRef<AbortController | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: (files) => {
      if (files[0]) setUploadFile(files[0]);
    },
  });

  async function handleProcessQuestionnaire() {
    if (!uploadFile) return;
    setShowUploadModal(false);
    setCurrentStatus("extracting");

    const fd = new FormData();
    fd.append("file", uploadFile);

    try {
      const res = await fetch(`/api/audits/${audit.id}/extract`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Extraction failed");
      const data = await res.json();
      setQuestions(data.questions);
      setCurrentStatus("review");
      toast.success(`Extracted ${data.questions.length} questions`);
    } catch {
      setCurrentStatus("idle");
      toast.error("Failed to extract questions from PDF");
    }
  }

  async function handleConfirmQuestions() {
    await fetch(`/api/audits/${audit.id}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });
    setCurrentStatus("ready");
    setShowRunDialog(true);
  }

  async function handleRunEvaluation(runMode: "all" | "failed-only" = "all") {
    setShowRunDialog(false);
    setCurrentStatus("evaluating");
    setEvaluationProgress(0);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const questionsToRun =
      runMode === "failed-only"
        ? questions.filter((q) => {
            const r = liveResults[q.id];
            return !r || r.verdict === "fail" || r.verdict === "partial";
          })
        : questions;

    let completed = 0;

    try {
      const res = await fetch(`/api/audits/${audit.id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runMode }),
        signal: ctrl.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.done) {
              setCurrentStatus("complete");
              setShowResultsModal(true);
              onAuditChange();
              return;
            }
            if (parsed.questionId) {
              completed++;
              setEvaluationProgress(
                Math.round((completed / questionsToRun.length) * 100),
              );
              setLiveResults((prev) => ({
                ...prev,
                [parsed.questionId]: parsed,
              }));
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Evaluation failed. Check your API key and try again.");
      }
      setCurrentStatus("ready");
    }
  }

  async function handleMarkCompliant(questionId: string, value: boolean) {
    await fetch(`/api/audits/${audit.id}/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, markedCompliant: value }),
    });
    setLiveResults((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        markedCompliant: value,
        markedCompliantBy: value ? "Sarah Chen" : undefined,
        markedCompliantAt: value ? new Date().toISOString() : undefined,
      },
    }));
    onAuditChange();
  }

  const allResults = Object.values(liveResults);
  const passCount = allResults.filter((r) => r.verdict === "pass").length;
  const failCount = allResults.filter(
    (r) => r.verdict === "fail" || r.verdict === "partial",
  ).length;
  const allPassed =
    currentStatus === "complete" && failCount === 0 && allResults.length > 0;
  const allMarked =
    currentStatus === "complete" &&
    allResults.filter((r) => r.verdict !== "pass" && !r.markedCompliant)
      .length === 0 &&
    allResults.length > 0;

  // ── Render ────────────────────────────────────────────────────

  if (currentStatus === "idle") {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            No questionnaire yet
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Upload the audit questionnaire PDF to begin the gap assessment. The
            AI will extract all questions and evaluate them against your policy
            library.
          </p>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload className="h-4 w-4" />
            Upload Questionnaire
          </Button>
        </div>
        <UploadModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          file={uploadFile}
          getRootProps={getRootProps}
          getInputProps={getInputProps}
          isDragActive={isDragActive}
          onProcess={handleProcessQuestionnaire}
        />
      </>
    );
  }

  if (currentStatus === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">
          Extracting questions…
        </h3>
        <p className="text-sm text-muted-foreground">
          The AI is reading your questionnaire and extracting compliance
          questions.
        </p>
      </div>
    );
  }

  if (currentStatus === "review") {
    return (
      <QuestionReview
        questions={questions}
        onQuestionsChange={setQuestions}
        onConfirm={handleConfirmQuestions}
        onReupload={() => {
          setCurrentStatus("idle");
          setUploadFile(null);
        }}
      />
    );
  }

  if (currentStatus === "ready") {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            Questionnaire ready — {questions.length} questions confirmed
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            The AI will evaluate each question against your policy library and
            return results with evidence.
          </p>
          <Button size="lg" onClick={() => setShowRunDialog(true)}>
            Run Audit
          </Button>
        </div>
        <RunAuditDialog
          open={showRunDialog}
          onOpenChange={setShowRunDialog}
          onRun={() => handleRunEvaluation("all")}
        />
      </>
    );
  }

  if (currentStatus === "evaluating") {
    const completed = Object.keys(liveResults).length;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">
            Evaluating questions…
          </h3>
          <span className="text-sm text-muted-foreground">
            {completed} / {questions.length}
          </span>
        </div>
        <Progress value={evaluationProgress} className="h-2" />
        <div className="space-y-2 mt-4">
          {questions.map((q) => (
            <EvaluationRow
              key={q.id}
              question={q}
              result={liveResults[q.id]}
              isEvaluating={!liveResults[q.id]}
              auditId={audit.id}
            />
          ))}
        </div>
      </div>
    );
  }

  if (currentStatus === "complete") {
    return (
      <AuditCompleteView
        auditId={audit.id}
        questions={questions}
        liveResults={liveResults}
        passCount={passCount}
        failCount={failCount}
        allPassed={allPassed}
        allMarked={allMarked}
        showResultsModal={showResultsModal}
        onResultsModalClose={() => setShowResultsModal(false)}
        onMarkCompliant={handleMarkCompliant}
        onRerun={handleRunEvaluation}
      />
    );
  }

  return null;
}
