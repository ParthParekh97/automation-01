import { createPureAdminClient } from "@/lib/supabase/server";
import { cancelSequence } from "@/lib/sequence";
import { NextResponse } from "next/server";

/**
 * POST /api/sequences/cancel
 * Body: { sequence_id }
 * Cancels an active email sequence.
 */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sequence_id } = body as Record<string, string>;
  if (!sequence_id) {
    return NextResponse.json({ error: "sequence_id is required" }, { status: 400 });
  }

  const supabase = createPureAdminClient();

  try {
    await cancelSequence(sequence_id, "manual_cancel", supabase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sequence-cancel]", err);
    return NextResponse.json({ error: "Failed to cancel sequence" }, { status: 500 });
  }
}
