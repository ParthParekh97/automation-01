import { createClient, createAdminClient } from "@/lib/supabase/server";
import { startSequence } from "@/lib/sequence";
import { NextResponse } from "next/server";
import { z } from "zod";

const createLeadSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  source: z.enum(["manual", "web", "facebook", "instagram", "google", "referral", "other"]).default("manual"),
  status: z.enum(["new", "contacted", "qualified", "proposal", "booked", "closed_won", "closed_lost"]).default("new"),
  client_id: z.string().uuid(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const client_id = searchParams.get("client_id");

  let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
  if (client_id) query = query.eq("client_id", client_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = createLeadSchema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase.from("leads").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-start email sequence for new leads that have an email address
  if (data && data.status === "new" && data.email) {
    const admin = await createAdminClient();
    startSequence(data.id, data.client_id, admin).catch((err) =>
      console.error("[leads] startSequence failed", err)
    );
  }

  return NextResponse.json(data, { status: 201 });
}
