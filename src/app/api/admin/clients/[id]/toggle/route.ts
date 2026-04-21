import { createPureAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createPureAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from("clients")
    .select("active")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const { error } = await supabase
    .from("clients")
    .update({ active: !current.active })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, active: !current.active });
}
