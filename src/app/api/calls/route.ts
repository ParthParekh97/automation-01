import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const createCallSchema = z.object({
  lead_id: z.string().uuid(),
  client_id: z.string().uuid(),
  outcome: z.enum(["no_answer", "voicemail", "callback", "interested", "not_interested", "booked", "other"]).default("no_answer"),
  duration: z.number().int().min(0).default(0),
  transcript: z.string().optional(),
  recording_url: z.string().url().optional(),
});

export async function GET(request: Request) {
  const supabase = createPureAdminClient();
  const { searchParams } = new URL(request.url);
  const client_id = searchParams.get("client_id");
  const lead_id = searchParams.get("lead_id");

  let query = supabase.from("calls").select("*, leads(name)").order("created_at", { ascending: false });
  if (client_id) query = query.eq("client_id", client_id);
  if (lead_id) query = query.eq("lead_id", lead_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = createPureAdminClient();
  const body = await request.json();
  const parsed = createCallSchema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase.from("calls").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
