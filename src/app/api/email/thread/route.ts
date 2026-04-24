import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lead_id = searchParams.get("lead_id");
  const client_id = searchParams.get("client_id");

  if (!lead_id || !client_id) {
    return NextResponse.json({ error: "lead_id and client_id are required" }, { status: 400 });
  }

  const supabase = createPureAdminClient();
  const { data, error } = await supabase
    .from("emails")
    .select("id, lead_id, client_id, subject, body, status, sent_at, direction, from_email, thread_id, gmail_message_id")
    .eq("lead_id", lead_id)
    .eq("client_id", client_id)
    .order("sent_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
