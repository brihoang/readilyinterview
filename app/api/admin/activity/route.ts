import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import type { ActivityAction } from "@/lib/store/types";

export async function GET(req: NextRequest) {
  await store.ensureActivitiesLoaded();

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") as ActivityAction | null;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let entries = store.getActivities();

  if (action) {
    entries = entries.filter((e) => e.action === action);
  }
  if (from) {
    const fromDate = new Date(from).getTime();
    entries = entries.filter((e) => new Date(e.timestamp).getTime() >= fromDate);
  }
  if (to) {
    const toDate = new Date(to).getTime() + 86_400_000; // inclusive end of day
    entries = entries.filter((e) => new Date(e.timestamp).getTime() <= toDate);
  }

  return NextResponse.json({ entries });
}
