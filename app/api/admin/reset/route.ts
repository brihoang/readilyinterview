import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST() {
  store.clearAudits();
  return NextResponse.json({ ok: true });
}
