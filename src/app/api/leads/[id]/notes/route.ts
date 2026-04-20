import { createAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lead_id } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content, client_id } = body as { content?: string; client_id?: string };
  if (!content?.trim() || !client_id) {
    return NextResponse.json({ error: "content and client_id are required" }, { status: 400 });
  }

  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({ lead_id, client_id, type: "note", content: content.trim(), metadata: {} })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
