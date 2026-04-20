import { createAdminClient } from "@/lib/supabase/server";
import { processSequence } from "@/lib/sequence";
import { NextResponse } from "next/server";

const tag = "[cron:sequence-process]";

/**
 * POST /api/cron/sequence-process
 * Protected by CRON_SECRET header.
 * Finds all active sequences whose next_send_at is due, processes each one.
 * Runs every 30 minutes via Vercel Cron.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createAdminClient();

  // Fetch all due sequences (partial index keeps this fast)
  const { data: sequences, error } = await supabase
    .from("email_sequences")
    .select("id, lead_id, client_id, current_step, thread_id, last_email_id")
    .eq("status", "active")
    .eq("replied", false)
    .lte("next_send_at", new Date().toISOString())
    .order("next_send_at", { ascending: true });

  if (error) {
    console.error(`${tag} query error`, error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  if (!sequences?.length) {
    console.log(`${tag} no sequences due`);
    return NextResponse.json({ processed: 0 });
  }

  console.log(`${tag} processing ${sequences.length} sequence(s)`);

  const results = await Promise.allSettled(
    sequences.map((seq) => processSequence(seq, supabase))
  );

  let succeeded = 0;
  let failed = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled" && r.value.ok) {
      succeeded++;
    } else {
      failed++;
      const err = r.status === "rejected" ? r.reason : r.value.error;
      console.error(`${tag} sequence ${sequences[i].id} failed:`, err);
    }
  });

  console.log(`${tag} done — ${succeeded} ok, ${failed} failed`);
  return NextResponse.json({ processed: sequences.length, succeeded, failed });
}
