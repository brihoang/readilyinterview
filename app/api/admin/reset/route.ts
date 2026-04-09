import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  await store.clearAudits();
  return NextResponse.json({ ok: true });
}
