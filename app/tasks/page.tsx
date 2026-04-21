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
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { AuditSummary } from "@/lib/store/types";
import { useCurrentUser } from "@/lib/context/UserContext";

export default function TasksPage() {
  const router = useRouter();
  const { currentUser } = useCurrentUser();
  const [audits, setAudits] = useState<AuditSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audits")
      .then((r) => r.json())
      .then((d) => setAudits(d.audits ?? []))
      .finally(() => setLoading(false));
  }, []);

  const outstanding = audits
    .filter(
      (a) =>
        a.status === "complete" &&
        (a.failCount + a.partialCount) > 0 &&
        a.createdBy === currentUser.displayName,
    )
    .sort((a, b) => {
      // Sort by target date ascending (most urgent first)
      if (!a.targetDate && !b.targetDate) return 0;
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime();
    });

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
          Audits with unresolved compliance issues
        </p>
      </div>

      {outstanding.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mb-5">
            <PartyPopper className="h-10 w-10 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-slate-800 mb-2">
            You&apos;re all caught up!
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            No outstanding compliance issues across any of your audits. Keep up
            the great work.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {outstanding.map((audit) => {
            const issueCount = audit.failCount + audit.partialCount;
            const daysUntil = audit.targetDate
              ? Math.ceil(
                  (new Date(audit.targetDate).getTime() - Date.now()) /
                    (1000 * 60 * 60 * 24),
                )
              : null;

            const urgency =
              daysUntil !== null && daysUntil <= 7
                ? "high"
                : daysUntil !== null && daysUntil <= 30
                  ? "medium"
                  : "low";

            return (
              <Card
                key={audit.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => router.push(`/audits/${audit.id}`)}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-semibold text-slate-800 truncate">
                        {audit.name}
                      </h3>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {audit.framework}
                      </Badge>
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
                            <span
                              className={
                                urgency === "high"
                                  ? "text-red-600 font-medium ml-1"
                                  : urgency === "medium"
                                    ? "text-amber-600 font-medium ml-1"
                                    : "ml-1"
                              }
                            >
                              ({daysUntil}d)
                            </span>
                          )}
                          {daysUntil !== null && daysUntil <= 0 && (
                            <span className="text-red-600 font-medium ml-1">
                              (overdue)
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-red-700">
                      <XCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {issueCount}/{audit.questionCount} need attention
                      </span>
                    </div>
                    {urgency === "high" && (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    {urgency === "medium" && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
