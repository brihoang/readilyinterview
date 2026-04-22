import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  await store.ensureAuditsLoaded();

  const allAudits = store.getAuditSummaries().map((s) => store.getAudit(s.id)!).filter(Boolean);

  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  let outstandingCount = 0;
  let exposureOpen = 0;
  let exposureClosed = 0;
  let resolvedLast7 = 0;
  let resolvedLast30 = 0;

  // Per-audit rows for the breakdown table
  const auditRows: {
    id: string;
    name: string;
    framework: string;
    status: string;
    totalQuestions: number;
    passing: number;
    outstanding: number;
    exposureOpen: number;
    exposureClosed: number;
  }[] = [];

  for (const audit of allAudits) {
    const results = Object.values(audit.results);
    let rowOutstanding = 0;
    let rowExposureOpen = 0;
    let rowExposureClosed = 0;

    for (const r of results) {
      const isFailing = r.verdict === "fail" || r.verdict === "partial";
      const exposure = r.estimatedExposure?.high ?? 0;

      if (isFailing && !r.markedCompliant && audit.status !== "archived") {
        outstandingCount++;
        rowOutstanding++;
        exposureOpen += exposure;
        rowExposureOpen += exposure;
      }

      // Exposure is only non-zero on fail/partial, so this correctly captures
      // failing questions resolved via manual sign-off or audit archive.
      if (isFailing && (r.markedCompliant || audit.status === "archived")) {
        exposureClosed += exposure;
        rowExposureClosed += exposure;
      }

      // AI-resolved: question evaluated to pass — use evaluatedAt for recency window
      if (r.verdict === "pass" && r.evaluatedAt) {
        const age = (now - new Date(r.evaluatedAt).getTime()) / msPerDay;
        if (age <= 7) resolvedLast7++;
        if (age <= 30) resolvedLast30++;
      }

      // Manually resolved: markedCompliant on a fail/partial — use markedCompliantAt
      if (isFailing && r.markedCompliant && r.markedCompliantAt) {
        const age = (now - new Date(r.markedCompliantAt).getTime()) / msPerDay;
        if (age <= 7) resolvedLast7++;
        if (age <= 30) resolvedLast30++;
      }
    }

    const passing = results.filter((r) => r.verdict === "pass").length;

    auditRows.push({
      id: audit.id,
      name: audit.name,
      framework: audit.framework,
      status: audit.status,
      totalQuestions: audit.questions.length,
      passing,
      outstanding: rowOutstanding,
      exposureOpen: rowExposureOpen,
      exposureClosed: rowExposureClosed,
    });
  }

  return NextResponse.json({
    outstandingCount,
    exposureOpen,
    exposureClosed,
    resolvedLast7,
    resolvedLast30,
    totalAudits: allAudits.length,
    auditRows,
  });
}
