import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string(),
});

const createConversationSchema = z.object({
  lead_id: z.string().uuid(),
  client_id: z.string().uuid(),
  channel: z.enum(["sms", "whatsapp", "facebook", "instagram", "webchat", "email"]),
  messages: z.array(messageSchema).default([]),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const client_id = searchParams.get("client_id");
  const lead_id = searchParams.get("lead_id");

  let query = supabase.from("conversations").select("*, leads(name)").order("created_at", { ascending: false });
  if (client_id) query = query.eq("client_id", client_id);
  if (lead_id) query = query.eq("lead_id", lead_id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const body = await request.json();
  const parsed = createConversationSchema.safeParse(body);

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data, error } = await supabase.from("conversations").insert(parsed.data).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
