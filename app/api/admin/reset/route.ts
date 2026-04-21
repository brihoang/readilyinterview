import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  await store.clearAudits();
  await store.clearPatches();
  await store.clearActivities();
  return NextResponse.json({ ok: true });
}
