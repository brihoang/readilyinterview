"use client"

import { useState, useCallback, useRef } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, AlertTriangle,
  ChevronDown, ChevronRight, Plus, Trash2, RotateCcw, PartyPopper
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import type { Audit, Question, QuestionResult, Verdict } from "@/lib/store/types"
import { toast } from "sonner"

interface Props {
  audit: Audit
  onAuditChange: () => void
}

type UIStatus = "idle" | "uploading" | "extracting" | "review" | "ready" | "evaluating" | "complete"

export function PrepWorkspace({ audit, onAuditChange }: Props) {
  const status = audit.status as UIStatus
  const [localAudit, setLocalAudit] = useState(audit)
  const [evaluationProgress, setEvaluationProgress] = useState(0)
  const [liveResults, setLiveResults] = useState<Record<string, QuestionResult>>(audit.results ?? {})
  const [showRunDialog, setShowRunDialog] = useState(false)
  const [showResultsModal, setShowResultsModal] = useState(false)
  const [showRerunModal, setShowRerunModal] = useState(false)
  const [currentStatus, setCurrentStatus] = useState<UIStatus>(status)
  const [questions, setQuestions] = useState<Question[]>(audit.questions)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // ── Upload & Extract ──────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    onDrop: (files) => {
      if (files[0]) setUploadFile(files[0])
    },
  })

  async function handleProcessQuestionnaire() {
    if (!uploadFile) return
    setShowUploadModal(false)
    setCurrentStatus("extracting")

    const fd = new FormData()
    fd.append("file", uploadFile)

    try {
      const res = await fetch(`/api/audits/${audit.id}/extract`, { method: "POST", body: fd })
      if (!res.ok) throw new Error("Extraction failed")
      const data = await res.json()
      setQuestions(data.questions)
      setCurrentStatus("review")
      toast.success(`Extracted ${data.questions.length} questions`)
    } catch {
      setCurrentStatus("idle")
      toast.error("Failed to extract questions from PDF")
    }
  }

  // ── Confirm questions ─────────────────────────────────────────
  async function handleConfirmQuestions() {
    await fetch(`/api/audits/${audit.id}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    })
    setCurrentStatus("ready")
    setShowRunDialog(true)
  }

  // ── Run evaluation ────────────────────────────────────────────
  async function handleRunEvaluation(runMode: "all" | "failed-only" = "all") {
    setShowRunDialog(false)
    setShowRerunModal(false)
    setCurrentStatus("evaluating")
    setEvaluationProgress(0)

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const questionsToRun =
      runMode === "failed-only"
        ? questions.filter((q) => {
            const r = liveResults[q.id]
            return !r || r.verdict === "fail" || r.verdict === "partial"
          })
        : questions

    let completed = 0

    try {
      const res = await fetch(`/api/audits/${audit.id}/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runMode }),
        signal: ctrl.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const parsed = JSON.parse(line)
            if (parsed.done) {
              setCurrentStatus("complete")
              setShowResultsModal(true)
              onAuditChange()
              return
            }
            if (parsed.questionId) {
              completed++
              setEvaluationProgress(Math.round((completed / questionsToRun.length) * 100))
              setLiveResults((prev) => ({ ...prev, [parsed.questionId]: parsed }))
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        toast.error("Evaluation failed. Check your API key and try again.")
      }
      setCurrentStatus("ready")
    }
  }

  // ── Mark compliant ────────────────────────────────────────────
  async function handleMarkCompliant(questionId: string, value: boolean) {
    await fetch(`/api/audits/${audit.id}/results`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, markedCompliant: value }),
    })
    setLiveResults((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        markedCompliant: value,
        markedCompliantBy: value ? "Sarah Chen" : undefined,
        markedCompliantAt: value ? new Date().toISOString() : undefined,
      },
    }))
    onAuditChange()
  }

  // Check if all non-compliant items are marked
  const allResults = Object.values(liveResults)
  const failedResults = allResults.filter((r) => r.verdict !== "pass" && !r.markedCompliant)
  const allMarked = currentStatus === "complete" && failedResults.length === 0 && allResults.length > 0

  const passCount = allResults.filter((r) => r.verdict === "pass").length
  const failCount = allResults.filter((r) => r.verdict === "fail" || r.verdict === "partial").length
  const allPassed = currentStatus === "complete" && failCount === 0 && allResults.length > 0

  // ── Render ────────────────────────────────────────────────────
  if (currentStatus === "idle") {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No questionnaire yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Upload the audit questionnaire PDF to begin the gap assessment. The AI will extract
            all questions and evaluate them against your policy library.
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
    )
  }

  if (currentStatus === "extracting") {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Extracting questions…</h3>
        <p className="text-sm text-muted-foreground">
          The AI is reading your questionnaire and extracting compliance questions.
        </p>
      </div>
    )
  }

  if (currentStatus === "review") {
    return (
      <QuestionReview
        questions={questions}
        onQuestionsChange={setQuestions}
        onConfirm={handleConfirmQuestions}
        onReupload={() => { setCurrentStatus("idle"); setUploadFile(null) }}
      />
    )
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
            The AI will evaluate each question against your policy library and return results with evidence.
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
    )
  }

  if (currentStatus === "evaluating") {
    const completed = Object.keys(liveResults).length
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-slate-800">Evaluating questions…</h3>
          <span className="text-sm text-muted-foreground">{completed} / {questions.length}</span>
        </div>
        <Progress value={evaluationProgress} className="h-2" />
        <div className="space-y-2 mt-4">
          {questions.map((q) => {
            const result = liveResults[q.id]
            return (
              <EvaluationRow key={q.id} question={q} result={result} isEvaluating={!result} />
            )
          })}
        </div>
      </div>
    )
  }

  if (currentStatus === "complete") {
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
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowRerunModal(true)}>
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
                  const r = liveResults[q.id]
                  return r && r.verdict !== "pass" && !r.markedCompliant
                })
                .map((q) => (
                  <EvaluationRow
                    key={q.id}
                    question={q}
                    result={liveResults[q.id]}
                    isEvaluating={false}
                    showMarkCompliant
                    onMarkCompliant={(v) => handleMarkCompliant(q.id, v)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* Marked compliant bucket */}
        {(() => {
          const marked = questions.filter((q) => liveResults[q.id]?.markedCompliant)
          if (marked.length === 0) return null
          return (
            <div className="mb-6">
              <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Marked Compliant ({marked.length})
              </h3>
              <div className="space-y-2">
                {marked.map((q) => {
                  const r = liveResults[q.id]
                  return (
                    <div key={q.id} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="flex-1 text-slate-700">{q.text}</span>
                      <span className="text-xs text-emerald-600">
                        Marked compliant by {r.markedCompliantBy} ·{" "}
                        {r.markedCompliantAt ? new Date(r.markedCompliantAt).toLocaleDateString() : ""}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

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
                <EvaluationRow key={q.id} question={q} result={liveResults[q.id]} isEvaluating={false} />
              ))}
          </div>
        </CollapsibleSection>

        {/* Results modal */}
        <Dialog open={showResultsModal} onOpenChange={setShowResultsModal}>
          <DialogContent className="sm:max-w-md text-center">
            {allPassed ? (
              <>
                <DialogHeader>
                  <div className="flex justify-center mb-2">
                    <PartyPopper className="h-12 w-12 text-amber-400" />
                  </div>
                  <DialogTitle className="text-center text-xl">All questions compliant!</DialogTitle>
                  <DialogDescription className="text-center">
                    Your policies satisfy all {questions.length} questionnaire requirements.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="justify-center">
                  <Button onClick={() => setShowResultsModal(false)}>View Full Report</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex justify-center mb-2">
                    <AlertTriangle className="h-10 w-10 text-amber-500" />
                  </div>
                  <DialogTitle className="text-center">{failCount} questions need attention</DialogTitle>
                  <DialogDescription className="text-center">
                    {passCount} of {questions.length} questions passed. Review the gaps below to
                    update your policies before the audit.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="justify-center">
                  <Button onClick={() => setShowResultsModal(false)}>Review Results</Button>
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
              <DialogDescription>Choose which questions to evaluate.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Button variant="outline" onClick={() => handleRunEvaluation("failed-only")}>
                <RotateCcw className="h-4 w-4" />
                Run Failed Questions Only
              </Button>
              <Button onClick={() => handleRunEvaluation("all")}>
                Run Full Suite ({questions.length} questions)
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* All-marked modal */}
        {allMarked && !showRerunModal && (
          <Dialog open={allMarked} onOpenChange={() => {}}>
            <DialogContent className="sm:max-w-sm text-center">
              <DialogHeader>
                <DialogTitle className="text-center">All questions addressed!</DialogTitle>
                <DialogDescription className="text-center">
                  Ready to re-run the audit to verify your updates?
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2 py-2">
                <Button onClick={() => { setShowRerunModal(true) }}>
                  Re-run Audit
                </Button>
                <Button variant="ghost" onClick={() => {}}>Not yet</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    )
  }

  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UploadModal({
  open, onOpenChange, file, getRootProps, getInputProps, isDragActive, onProcess,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  file: File | null
  getRootProps: ReturnType<typeof useDropzone>["getRootProps"]
  getInputProps: ReturnType<typeof useDropzone>["getInputProps"]
  isDragActive: boolean
  onProcess: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Questionnaire</DialogTitle>
          <DialogDescription>Upload your audit questionnaire PDF to extract compliance questions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{file.name}</span>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">
                  {isDragActive ? "Drop the PDF here" : "Drag & drop a PDF, or click to browse"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF files only</p>
              </>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              Google Drive URL
              <Badge variant="secondary" className="text-xs font-normal">Coming soon</Badge>
            </Label>
            <Input disabled placeholder="https://docs.google.com/..." className="opacity-50 cursor-not-allowed" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onProcess} disabled={!file}>Process Questionnaire</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RunAuditDialog({ open, onOpenChange, onRun }: { open: boolean; onOpenChange: (v: boolean) => void; onRun: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Run Audit?</DialogTitle>
          <DialogDescription>
            The AI will evaluate each question against your policy library. This may take a few minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Save for Later</Button>
          <Button onClick={onRun}>Run Now</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QuestionReview({
  questions, onQuestionsChange, onConfirm, onReupload,
}: {
  questions: Question[]
  onQuestionsChange: (q: Question[]) => void
  onConfirm: () => void
  onReupload: () => void
}) {
  function updateQuestion(id: string, text: string) {
    onQuestionsChange(questions.map((q) => q.id === id ? { ...q, text, isEdited: true } : q))
  }

  function deleteQuestion(id: string) {
    onQuestionsChange(questions.filter((q) => q.id !== id))
  }

  function addQuestion() {
    const newQ: Question = {
      id: Math.random().toString(36).slice(2),
      auditId: questions[0]?.auditId ?? "",
      orderIndex: questions.length,
      category: "General",
      text: "",
      source: "Manual",
      isEdited: true,
    }
    onQuestionsChange([...questions, newQ])
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">Review Extracted Questions</h3>
          <p className="text-sm text-muted-foreground">Found {questions.length} questions — edit before confirming</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReupload}>Re-upload</Button>
          <Button onClick={onConfirm} disabled={questions.length === 0}>Confirm Questions</Button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="flex gap-3 p-4 bg-white rounded-xl border">
            <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 pt-1">{i + 1}</span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">{q.category}</Badge>
                <Badge variant="secondary" className="text-xs">{q.source}</Badge>
                {q.isEdited && <Badge variant="warning" className="text-xs">Edited</Badge>}
              </div>
              <textarea
                className="w-full text-sm text-slate-700 resize-none bg-transparent focus:outline-none focus:ring-1 focus:ring-primary rounded p-1 -m-1"
                rows={2}
                value={q.text}
                onChange={(e) => updateQuestion(q.id, e.target.value)}
              />
            </div>
            <button
              onClick={() => deleteQuestion(q.id)}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addQuestion}
        className="mt-3 flex items-center gap-1.5 text-sm text-primary hover:underline"
      >
        <Plus className="h-4 w-4" />
        Add question
      </button>
    </div>
  )
}

function EvaluationRow({
  question, result, isEvaluating, showMarkCompliant, onMarkCompliant,
}: {
  question: Question
  result?: QuestionResult
  isEvaluating: boolean
  showMarkCompliant?: boolean
  onMarkCompliant?: (v: boolean) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const verdictConfig: Record<Verdict, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
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
      icon: <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />,
      color: "text-muted-foreground",
      bg: "bg-white",
      label: "Pending",
    },
  }

  const verdict = result?.verdict ?? (isEvaluating ? "pending" : "pending")
  const cfg = verdictConfig[verdict]

  return (
    <div className={cn("rounded-xl border transition-colors", result ? cfg.bg : "bg-white border-border")}>
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
            <Badge variant="outline" className="text-xs shrink-0">{question.category}</Badge>
            {result && (
              <span className={cn("text-xs font-medium", cfg.color)}>{cfg.label}</span>
            )}
            {result && typeof result.confidence === "number" && (
              <span className="text-xs text-muted-foreground ml-auto">
                {result.confidence}% confidence
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
                  {result.verdict === "pass" ? "Supporting Policy Language" : "Related Policy Found"}
                </p>
                <blockquote className="border-l-2 border-primary pl-3 text-slate-700 italic text-sm leading-relaxed">
                  &ldquo;{result.evidenceText}&rdquo;
                </blockquote>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {result.sourceDocumentTitle}
                  {result.sourceSectionTitle ? ` — ${result.sourceSectionTitle}` : ""}
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Reasoning</p>
              <p className="text-slate-600">{result.reasoning}</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function CollapsibleSection({
  title, icon, children, defaultOpen = false,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3 hover:text-slate-900 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        {title}
      </button>
      {open && children}
    </div>
  )
}
