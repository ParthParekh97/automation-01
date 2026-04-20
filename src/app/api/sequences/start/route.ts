import { createAdminClient } from "@/lib/supabase/server";
import { startSequence } from "@/lib/sequence";
import { NextResponse } from "next/server";

/**
 * POST /api/sequences/start
 * Body: { lead_id, client_id }
 * Manually kick off an email sequence for a lead.
 */
export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lead_id, client_id } = body as Record<string, string>;
  if (!lead_id || !client_id) {
    return NextResponse.json({ error: "lead_id and client_id are required" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  try {
    await startSequence(lead_id, client_id, supabase);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sequence-start]", err);
    return NextResponse.json({ error: "Failed to start sequence" }, { status: 500 });
  }
}
