"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PartyPopper,
  AlertTriangle,
  Building2,
  Calendar,
  ArrowRight,
  XCircle,
  CheckSquare,
  Square,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuditSummary, ActionItem } from "@/lib/store/types";
import { useCurrentUser } from "@/lib/context/UserContext";
import { DEMO_USERS } from "@/lib/users";
import { cn } from "@/lib/utils";

type TaskItem =
  | { kind: "audit"; data: AuditSummary }
  | { kind: "action"; data: ActionItem };

const STATUS_CONFIG: Record<string, { label: string; variant: "success" | "info" | "warning" | "secondary" }> = {
  idle: { label: "Draft", variant: "secondary" },
  review: { label: "In Review", variant: "warning" },
  ready: { label: "Ready for AI Audit", variant: "info" },
  evaluating: { label: "Evaluating", variant: "warning" },
  complete: { label: "Needs Review", variant: "warning" },
};

function getStatusConfig(a: AuditSummary) {
  if (a.status === "complete" && (a.failCount + a.partialCount) === 0) {
    return { label: "AI Verified", variant: "success" as const };
  }
  return STATUS_CONFIG[a.status] ?? STATUS_CONFIG.idle;
}

export default function TasksPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/audits").then((r) => r.json()),
      fetch("/api/action-items").then((r) => r.json()),
    ]).then(([auditData, actionData]) => {
      setAudits(auditData.audits ?? []);
      setActionItems(actionData.items ?? []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleCompleteAction(item: ActionItem) {
    const res = await fetch(`/api/action-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        completedAt: new Date().toISOString(),
        completedBy: currentUser.displayName,
      }),
    });
    const data = await res.json();
    setActionItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
  }

  const outstandingAudits = audits
    .filter(
      (a) =>
        a.status !== "archived" &&
        (
          !a.createdBy ||
          a.createdBy === currentUser.displayName ||
          a.stakeholders?.includes(currentUser.displayName)
        ),
    )
    .sort((a, b) => {
      if (!a.targetDate && !b.targetDate) return 0;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

  const myOpenActions = actionItems.filter(
    (i) => i.assignedTo === currentUser.displayName && i.status === "open"
  );

  const tasks: TaskItem[] = [
    ...outstandingAudits.map((a): TaskItem => ({ kind: "audit", data: a })),
    ...myOpenActions.map((a): TaskItem => ({ kind: "action", data: a })),
  ];

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Outstanding Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Audits with unresolved compliance issues
          </p>
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-xl border bg-white animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Outstanding Tasks</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your active audits and open action items
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-5">
            <PartyPopper className="h-10 w-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            You&apos;re all caught up!
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            No outstanding compliance issues across any of your audits. Keep up the great work.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            if (task.kind === "audit") {
              const audit = task.data;
              const issueCount = audit.failCount + audit.partialCount;
              const hasIssues = audit.status === "complete" && issueCount > 0;
              const statusCfg = getStatusConfig(audit);
              const daysUntil = audit.targetDate
                ? Math.ceil((new Date(audit.targetDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const urgency =
                daysUntil !== null && daysUntil <= 7 ? "high"
                : daysUntil !== null && daysUntil <= 30 ? "medium"
                : "low";

              return (
                <Card
                  key={`audit-${audit.id}`}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => router.push(`/audits/${audit.id}`)}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="font-semibold text-slate-800 truncate">{audit.name}</h3>
                        <Badge variant={statusCfg.variant} className="shrink-0">{statusCfg.label}</Badge>
                        <Badge variant="outline" className="text-xs shrink-0">{audit.framework}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" />
                          {audit.organization}
                        </span>
                        {audit.targetDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(audit.targetDate).toLocaleDateString()}
                            {daysUntil !== null && daysUntil > 0 && (
                              <span className={cn("ml-1", urgency === "high" ? "text-red-600 font-medium" : urgency === "medium" ? "text-amber-600 font-medium" : "")}>
                                ({daysUntil}d)
                              </span>
                            )}
                            {daysUntil !== null && daysUntil <= 0 && (
                              <span className="text-red-600 font-medium ml-1">(overdue)</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {hasIssues && (
                        <div className="flex items-center gap-1.5 text-red-700">
                          <XCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">{issueCount}/{audit.questionCount} need attention</span>
                        </div>
                      )}
                      {urgency === "high" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                      {urgency === "medium" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              );
            }

            // Action item card
            const item = task.data;
            const user = DEMO_USERS.find((u) => u.displayName === item.assignedTo);
            return (
              <Card key={`action-${item.id}`} className="border-dashed">
                <CardContent className="flex items-start gap-4 p-5">
                  <Square className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs shrink-0">Action Item</Badge>
                      {item.auditId && item.auditName && (
                        <button
                          onClick={() => router.push(`/audits/${item.auditId}`)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {item.auditName}
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-800">{item.text}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {user && (
                        <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white", user.color)}>
                          {user.initials}
                          <span className="font-normal opacity-90">{user.displayName}</span>
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        Added {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => handleCompleteAction(item)}
                  >
                    <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
                    Mark Complete
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
