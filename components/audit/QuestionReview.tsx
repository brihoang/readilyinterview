"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Question } from "@/lib/store/types";

export function QuestionReview({
  questions,
  onQuestionsChange,
  onConfirm,
  onReupload,
}: {
  questions: Question[];
  onQuestionsChange: (q: Question[]) => void;
  onConfirm: () => void;
  onReupload: () => void;
}) {
  function updateQuestion(id: string, text: string) {
    onQuestionsChange(
      questions.map((q) => (q.id === id ? { ...q, text, isEdited: true } : q)),
    );
  }

  function deleteQuestion(id: string) {
    onQuestionsChange(questions.filter((q) => q.id !== id));
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
    };
    onQuestionsChange([...questions, newQ]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-slate-800">
            Review Extracted Questions
          </h3>
          <p className="text-sm text-muted-foreground">
            Found {questions.length} questions — edit before confirming
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReupload}>
            Re-upload
          </Button>
          <Button onClick={onConfirm} disabled={questions.length === 0}>
            Confirm Questions
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <div key={q.id} className="flex gap-3 p-4 bg-white rounded-xl border">
            <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 pt-1">
              {i + 1}
            </span>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-xs">
                  {q.category}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {q.source}
                </Badge>
                {q.isEdited && (
                  <Badge variant="warning" className="text-xs">
                    Edited
                  </Badge>
                )}
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
  );
}
