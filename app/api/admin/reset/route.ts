import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  await store.clearAudits();
  await store.clearPatches();
  return NextResponse.json({ ok: true });
}
